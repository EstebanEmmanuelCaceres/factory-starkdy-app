<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\Pago;
use App\Models\Pedido;
use App\Models\Producto;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TiendanubeSincronizarTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.tiendanube', [
            'store_id' => '1234567', 'access_token' => 'token-de-prueba', 'user_agent' => 'StarkDY Test',
            'client_secret' => null, 'webhook_url' => null, 'app_id' => null, 'user_id' => null,
        ]);

        $role = Role::create(['name' => 'Admin', 'slug' => 'admin']);
        User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => bcrypt('x'), 'role_id' => $role->id]);
        Producto::create(['nombre' => 'Cubrepatente', 'sku' => 'CUBRE-01']);
    }

    private function orden(int $id, array $override = []): array
    {
        return array_merge([
            'id' => $id, 'number' => $id - 1000, 'status' => 'open', 'payment_status' => 'paid',
            'currency' => 'ARS', 'total' => '5000.00', 'gateway_name' => 'Mercado Pago',
            'paid_at' => '2026-11-25T10:00:00-0300',
            'contact_name' => "Cliente {$id}", 'contact_email' => "cliente{$id}@example.com", 'contact_phone' => '223555',
            'products' => [['name' => 'Cubrepatente', 'sku' => 'CUBRE-01', 'quantity' => 1]],
        ], $override);
    }

    /** Responde las páginas de GET /orders en orden; la última respuesta es 404 como hace Tiendanube sin resultados. */
    private function fakeOrdenes(array ...$paginas): void
    {
        Http::swap(new Factory());
        $secuencia = Http::sequence();
        foreach ($paginas as $pagina) {
            $secuencia->push($pagina);
        }
        $secuencia->push(['code' => 404, 'description' => 'Last page is 0'], 404);
        Http::fake(['api.tiendanube.com/*' => $secuencia]);
    }

    public function test_crea_pedidos_de_las_ordenes_pagadas_con_su_pago(): void
    {
        $this->fakeOrdenes([$this->orden(1001), $this->orden(1002)]);

        $this->artisan('tiendanube:sincronizar')->assertSuccessful();

        $this->assertSame(2, Pedido::count());
        $this->assertSame(2, Pago::count());
        $this->assertSame(['TN-1', 'TN-2'], Pedido::orderBy('id')->pluck('codigo')->all());
        Http::assertSent(fn ($r) => str_starts_with($r->url(), 'https://api.tiendanube.com/v1/1234567/orders')
            && $r->hasHeader('Authentication', 'bearer token-de-prueba')
            && isset($r->data()['updated_at_min']));
    }

    public function test_correr_dos_veces_no_duplica(): void
    {
        $this->fakeOrdenes([$this->orden(1001)]);
        $this->artisan('tiendanube:sincronizar')->assertSuccessful();

        $this->fakeOrdenes([$this->orden(1001)]);
        $this->artisan('tiendanube:sincronizar')->assertSuccessful();

        $this->assertSame(1, Pedido::count());
        $this->assertSame(1, Pago::count());
        $this->assertSame(1, Cliente::count());
    }

    public function test_ignora_ordenes_sin_pagar_y_las_importa_cuando_se_pagan(): void
    {
        $this->fakeOrdenes([$this->orden(1001, ['payment_status' => 'pending', 'paid_at' => null])]);
        $this->artisan('tiendanube:sincronizar')->assertSuccessful();
        $this->assertSame(0, Pedido::count());

        $this->fakeOrdenes([$this->orden(1001)]);
        $this->artisan('tiendanube:sincronizar')->assertSuccessful();
        $this->assertSame(1, Pedido::count());
        $this->assertSame(1, Pago::count());
    }

    public function test_orden_cancelada_cancela_el_pedido_existente(): void
    {
        $this->fakeOrdenes([$this->orden(1001)]);
        $this->artisan('tiendanube:sincronizar')->assertSuccessful();

        $this->fakeOrdenes([$this->orden(1001, ['status' => 'cancelled'])]);
        $this->artisan('tiendanube:sincronizar')->assertSuccessful();

        $this->assertSame('cancelado', Pedido::first()->estado);
    }

    public function test_orden_cancelada_que_nunca_se_importo_se_ignora(): void
    {
        $this->fakeOrdenes([$this->orden(1001, ['status' => 'cancelled'])]);

        $this->artisan('tiendanube:sincronizar')->assertSuccessful();

        $this->assertSame(0, Pedido::count());
    }

    public function test_recorre_todas_las_paginas(): void
    {
        $this->fakeOrdenes([$this->orden(1001), $this->orden(1002)], [$this->orden(1003)]);

        $this->artisan('tiendanube:sincronizar', ['--por-pagina' => 2])->assertSuccessful();

        $this->assertSame(3, Pedido::count());
    }

    public function test_sin_resultados_la_api_responde_404_y_no_falla(): void
    {
        $this->fakeOrdenes();

        $this->artisan('tiendanube:sincronizar')->assertSuccessful();

        $this->assertSame(0, Pedido::count());
    }

    public function test_una_orden_con_error_no_frena_a_las_demas(): void
    {
        $this->fakeOrdenes([$this->orden(1001, ['total' => 'no-es-numero', 'products' => 'roto']), $this->orden(1002)]);

        $this->artisan('tiendanube:sincronizar')->assertFailed();

        $this->assertNotNull(Pedido::where('tiendanube_order_id', '1002')->first());
    }

    public function test_el_scheduler_tiene_la_tarea_cada_cinco_minutos(): void
    {
        $eventos = collect(app(\Illuminate\Console\Scheduling\Schedule::class)->events())
            ->filter(fn ($e) => str_contains($e->command, 'tiendanube:sincronizar'));

        $this->assertCount(1, $eventos);
        $this->assertSame('*/5 * * * *', $eventos->first()->expression);
    }
}
