<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\Pago;
use App\Models\Pedido;
use App\Models\Producto;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TiendanubeWebhookTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'secreto-de-prueba';
    private const STORE_ID = '1234567';

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.tiendanube', [
            'app_id' => '1',
            'client_secret' => self::SECRET,
            'store_id' => self::STORE_ID,
            'access_token' => 'token-de-prueba',
            'user_agent' => 'StarkDY Test',
            'webhook_url' => 'https://ejemplo.test/api/webhooks/tiendanube',
            'user_id' => null,
        ]);

        $role = Role::create(['name' => 'Admin', 'slug' => 'admin']);
        $this->admin = User::create([
            'name' => 'Admin Test',
            'email' => 'admin@example.com',
            'password' => bcrypt('password'),
            'role_id' => $role->id,
        ]);

        Producto::create(['nombre' => 'Cubrepatente', 'sku' => 'CUBRE-01']);
    }

    /** Orden de ejemplo con la forma de GET /orders/{id} de Tiendanube. */
    private function orden(array $override = []): array
    {
        return array_merge([
            'id' => 987654321,
            'number' => 1001,
            'status' => 'open',
            'payment_status' => 'paid',
            'currency' => 'ARS',
            'total' => '15000.00',
            'gateway_name' => 'Mercado Pago',
            'paid_at' => '2026-11-10T14:00:00-0300',
            'note' => 'Entregar por la tarde',
            'contact_name' => 'Lucía Gómez',
            'contact_email' => 'lucia@example.com',
            'contact_phone' => '+5492235551234',
            'contact_identification' => '30123456',
            'shipping_address' => [
                'address' => 'Colón', 'number' => '1234', 'locality' => 'Mar del Plata',
                'province' => 'Buenos Aires', 'zipcode' => '7600',
            ],
            'products' => [
                ['name' => 'Cubrepatente', 'sku' => 'CUBRE-01', 'quantity' => 2, 'price' => '7500.00', 'variant_values' => ['Negro']],
            ],
        ], $override);
    }

    /** Dispara el webhook como lo haría Tiendanube: body JSON crudo + HMAC-SHA256 en el header. */
    private function webhook(string $evento, int|string $ordenId = 987654321, ?string $firma = null)
    {
        $body = json_encode(['store_id' => (int) self::STORE_ID, 'event' => $evento, 'id' => $ordenId]);
        $firma ??= hash_hmac('sha256', $body, self::SECRET);

        return $this->call('POST', '/api/webhooks/tiendanube', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_LINKEDSTORE_HMAC_SHA256' => $firma,
        ], $body);
    }

    private function fakeApi(array $orden): void
    {
        // Factory nuevo: si no, los fakes previos (que matchean primero) pisan al nuevo
        Http::swap(new \Illuminate\Http\Client\Factory());
        Http::fake(['api.tiendanube.com/*' => Http::response($orden)]);
    }

    public function test_rechaza_webhook_con_firma_invalida(): void
    {
        Http::fake();

        $this->webhook('order/paid', 987654321, 'firma-falsa')->assertStatus(401);

        $this->assertSame(0, Pedido::count());
        Http::assertNothingSent();
    }

    public function test_rechaza_webhook_sin_firma(): void
    {
        Http::fake();

        $this->postJson('/api/webhooks/tiendanube', ['store_id' => 1, 'event' => 'order/paid', 'id' => 1])->assertStatus(401);

        $this->assertSame(0, Pedido::count());
    }

    public function test_orden_pagada_crea_cliente_pedido_linea_y_pago(): void
    {
        $this->fakeApi($this->orden());

        $this->webhook('order/paid')->assertOk()->assertJsonPath('status', 'ok');

        // Se consultó el detalle a la API con las credenciales correctas
        Http::assertSent(fn ($r) => $r->url() === 'https://api.tiendanube.com/v1/1234567/orders/987654321'
            && $r->hasHeader('Authentication', 'bearer token-de-prueba')
            && $r->hasHeader('User-Agent', 'StarkDY Test'));

        $cliente = Cliente::where('email', 'lucia@example.com')->first();
        $this->assertNotNull($cliente);
        $this->assertSame('Lucía Gómez', $cliente->nombre_cliente);
        $this->assertSame('30123456', $cliente->dni);
        $this->assertSame('Colón 1234', $cliente->direccion);

        $pedido = Pedido::with(['productos', 'pagos'])->where('tiendanube_order_id', '987654321')->first();
        $this->assertNotNull($pedido);
        $this->assertSame('TN-1001', $pedido->codigo);
        $this->assertSame('tiendanube', $pedido->origen);
        $this->assertSame('pendiente', $pedido->estado);
        $this->assertSame($cliente->id, $pedido->cliente_id);
        $this->assertSame($this->admin->id, $pedido->user_id);
        $this->assertEquals(15000.00, $pedido->precio);
        $this->assertStringContainsString('Entregar por la tarde', $pedido->comentario);

        $this->assertCount(1, $pedido->productos);
        $this->assertSame(2, (int) $pedido->productos->first()->pivot->cantidad);

        $this->assertCount(1, $pedido->pagos);
        $pago = $pedido->pagos->first();
        $this->assertSame(Pago::ESTADO_PAGADO, $pago->estado);
        $this->assertEquals(15000.00, $pago->monto);
        $this->assertSame('Mercado Pago', $pago->medio_pago);
        $this->assertSame('tiendanube:987654321', $pago->referencia_externa);
        $this->assertSame('pagado', $pedido->estado_pago);
    }

    public function test_webhook_repetido_no_duplica_pedido_ni_pago(): void
    {
        $this->fakeApi($this->orden());

        $this->webhook('order/paid')->assertOk();
        $this->webhook('order/paid')->assertOk();

        $this->assertSame(1, Pedido::count());
        $this->assertSame(1, Pago::count());
        $this->assertSame(1, Cliente::count());
    }

    public function test_orden_creada_sin_pagar_y_luego_pagada_queda_un_solo_pedido_con_un_pago(): void
    {
        $this->fakeApi($this->orden(['payment_status' => 'pending', 'paid_at' => null]));
        $this->webhook('order/created')->assertOk();

        $pedido = Pedido::first();
        $this->assertSame('sin_pago', $pedido->estado_pago);
        $this->assertSame(0, Pago::count());

        $this->fakeApi($this->orden());
        $this->webhook('order/paid')->assertOk();

        $this->assertSame(1, Pedido::count());
        $this->assertSame(1, Pago::count());
        $this->assertSame('pagado', $pedido->fresh()->estado_pago);
    }

    public function test_producto_sin_sku_coincidente_crea_el_pedido_y_lo_avisa_en_el_comentario(): void
    {
        $this->fakeApi($this->orden(['products' => [
            ['name' => 'Cubrepatente', 'sku' => 'CUBRE-01', 'quantity' => 1],
            ['name' => 'Llavero raro', 'sku' => 'NO-EXISTE', 'quantity' => 3],
            ['name' => 'Sticker sin sku', 'sku' => null, 'quantity' => 1],
        ]]));

        $this->webhook('order/paid')->assertOk();

        $pedido = Pedido::with('productos')->first();
        $this->assertCount(1, $pedido->productos);
        $this->assertStringContainsString('PRODUCTOS SIN MAPEAR', $pedido->comentario);
        $this->assertStringContainsString('Llavero raro x3 (SKU NO-EXISTE)', $pedido->comentario);
        $this->assertStringContainsString('Sticker sin sku x1 (sin SKU)', $pedido->comentario);
    }

    public function test_sin_sku_coincidente_mapea_por_nombre_exacto(): void
    {
        $producto = Producto::create(['nombre' => 'Llavero Acrílico']);
        $this->fakeApi($this->orden(['products' => [
            ['name' => 'llavero acrílico', 'sku' => '', 'quantity' => 4],
        ]]));

        $this->webhook('order/paid')->assertOk();

        $pedido = Pedido::with('productos')->first();
        $this->assertCount(1, $pedido->productos);
        $this->assertSame($producto->id, $pedido->productos->first()->id);
        $this->assertSame(4, (int) $pedido->productos->first()->pivot->cantidad);
    }

    public function test_nombre_ambiguo_no_se_mapea(): void
    {
        Producto::create(['nombre' => 'Sticker']);
        Producto::create(['nombre' => 'sticker']);
        $this->fakeApi($this->orden(['products' => [['name' => 'Sticker', 'sku' => null, 'quantity' => 1]]]));

        $this->webhook('order/paid')->assertOk();

        $this->assertCount(0, Pedido::with('productos')->first()->productos);
        $this->assertStringContainsString('PRODUCTOS SIN MAPEAR', Pedido::first()->comentario);
    }

    public function test_mismo_producto_repetido_en_la_orden_suma_la_cantidad(): void
    {
        $this->fakeApi($this->orden(['products' => [
            ['name' => 'Cubrepatente', 'sku' => 'CUBRE-01', 'quantity' => 1, 'variant_values' => ['Negro']],
            ['name' => 'Cubrepatente', 'sku' => 'CUBRE-01', 'quantity' => 2, 'variant_values' => ['Blanco']],
        ]]));

        $this->webhook('order/paid')->assertOk();

        $pedido = Pedido::with('productos')->first();
        $this->assertCount(1, $pedido->productos);
        $this->assertSame(3, (int) $pedido->productos->first()->pivot->cantidad);
    }

    public function test_cliente_existente_por_email_se_reutiliza(): void
    {
        $existente = Cliente::create([
            'nombre_cliente' => 'Lucía G.', 'nombre_empresa' => 'Lucía G.', 'telefono' => '1', 'email' => 'LUCIA@EXAMPLE.COM',
        ]);
        $this->fakeApi($this->orden(['contact_email' => 'lucia@example.com']));

        $this->webhook('order/paid')->assertOk();

        $this->assertSame(1, Cliente::count());
        $this->assertSame($existente->id, Pedido::first()->cliente_id);
    }

    public function test_falla_api_tiendanube_retorna_500_para_reintento(): void
    {
        Http::swap(new \Illuminate\Http\Client\Factory());
        Http::fake(['api.tiendanube.com/*' => Http::response('Server error', 500)]);

        $this->webhook('order/paid')->assertStatus(500)->assertJsonPath('status', 'error');

        $this->assertSame(0, Pedido::count());
    }

    public function test_orden_cancelada_cancela_el_pedido(): void
    {
        $this->fakeApi($this->orden());
        $this->webhook('order/paid')->assertOk();

        $this->webhook('order/cancelled')->assertOk();

        $this->assertSame('cancelado', Pedido::first()->estado);
    }

    public function test_evento_no_soportado_se_ignora_sin_llamar_a_la_api(): void
    {
        Http::fake();

        $this->webhook('product/updated')->assertOk()->assertJsonPath('status', 'ignored');

        $this->assertSame(0, Pedido::count());
        Http::assertNothingSent();
    }

    public function test_webhook_de_otra_tienda_se_ignora(): void
    {
        Http::fake();
        $body = json_encode(['store_id' => 999, 'event' => 'order/paid', 'id' => 1]);

        $this->call('POST', '/api/webhooks/tiendanube', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_LINKEDSTORE_HMAC_SHA256' => hash_hmac('sha256', $body, self::SECRET),
        ], $body)->assertOk()->assertJsonPath('status', 'ignored');

        $this->assertSame(0, Pedido::count());
        Http::assertNothingSent();
    }

    public function test_producto_controller_permite_crear_y_editar_sku(): void
    {
        $response = $this->actingAs($this->admin)->postJson('/api/productos', [
            'nombre' => 'Llavero Metal',
            'sku' => 'LLAV-01',
            'precio' => 1500,
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('productos', [
            'nombre' => 'Llavero Metal',
            'sku' => 'LLAV-01',
        ]);

        $id = $response->json('data.id');
        $this->actingAs($this->admin)->patchJson("/api/productos/{$id}", [
            'sku' => 'LLAV-02',
        ])->assertOk();

        $this->assertDatabaseHas('productos', [
            'id' => $id,
            'sku' => 'LLAV-02',
        ]);
    }

    public function test_pedido_tiendanube_al_editar_y_agregar_productos_a_mano_se_crean_las_tareas(): void
    {
        // 1. Llega una orden con un producto que NO existe en el catálogo
        $this->fakeApi($this->orden(['products' => [
            ['name' => 'Producto Desconocido', 'sku' => 'NO-EXISTE', 'quantity' => 1],
        ]]));
        $this->webhook('order/paid')->assertOk();

        $pedido = Pedido::where('tiendanube_order_id', '987654321')->first();
        $this->assertNotNull($pedido);
        $this->assertCount(0, $pedido->productos);
        $this->assertSame(0, $pedido->tareas()->count());

        // 2. Un usuario del sistema edita el pedido y le asigna un producto existente (ej. Cubrepatente)
        $cubrepatente = Producto::where('sku', 'CUBRE-01')->first();
        $this->actingAs($this->admin)->patchJson("/api/pedidos/{$pedido->id}", [
            'productos' => [
                ['id' => $cubrepatente->id, 'cantidad' => 1],
            ],
        ])->assertOk();

        // 3. El pedido ahora tiene el producto y se crearon automáticamente sus tareas de fabricación
        $pedido->refresh();
        $this->assertCount(1, $pedido->productos);
        $this->assertGreaterThan(0, $pedido->tareas()->count());
    }
}
