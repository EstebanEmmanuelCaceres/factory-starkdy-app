<?php

namespace Tests\Unit;

use App\Models\Producto;
use App\Repositories\PedidoProductoRepository;
use App\Services\UnidadesVendidasService;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Mockery;
use Tests\TestCase;

class UnidadesVendidasServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        Mockery::close();
        parent::tearDown();
    }

    public function test_compara_mes_anterior_vs_anteanterior_cuando_el_rango_incluye_el_mes_corriente(): void
    {
        // Fijamos la fecha actual en 18 de Noviembre de 2026
        Carbon::setTestNow(Carbon::create(2026, 11, 18, 12, 0, 0));

        $mockRepo = Mockery::mock(PedidoProductoRepository::class);

        // Simulamos registros retornados por el repositorio para un producto:
        // Sep 2026: 30 unidades
        // Oct 2026: 14676 unidades
        // Nov 2026: 4931 unidades (mes corriente incompleto)
        $productoMock = (object) [
            'id' => 1,
            'nombre' => 'Producto Prueba',
            'sku' => 'SKU-001',
        ];

        $registros = collect([
            (object) [
                'producto_id' => 1,
                'anio' => 2026,
                'mes' => 9,
                'unidades_vendidas' => 30,
                'producto' => $productoMock,
            ],
            (object) [
                'producto_id' => 1,
                'anio' => 2026,
                'mes' => 10,
                'unidades_vendidas' => 14676,
                'producto' => $productoMock,
            ],
            (object) [
                'producto_id' => 1,
                'anio' => 2026,
                'mes' => 11,
                'unidades_vendidas' => 4931,
                'producto' => $productoMock,
            ],
        ]);

        $mockRepo->shouldReceive('obtenerUnidadesPorProductoYMes')
            ->once()
            ->andReturn($registros);

        $service = new UnidadesVendidasService($mockRepo);

        // Filtro por defecto (últimos 6 meses hasta Noviembre 2026)
        $resultado = $service->obtenerUnidadesVendidasPorIntervalo([
            'anio' => 2026,
            'mes_desde' => 6,
            'mes_hasta' => 11,
        ]);

        $comparacion = $resultado['periodo']['comparacion'];

        // Debe comparar Octubre 2026 (mes anterior) contra Septiembre 2026 (anterior a ese)
        $this->assertSame('2026-10', $comparacion['mes_actual_clave']);
        $this->assertSame('Oct 2026', $comparacion['mes_actual_etiqueta']);
        $this->assertSame('2026-09', $comparacion['mes_anterior_clave']);
        $this->assertSame('Sep 2026', $comparacion['mes_anterior_etiqueta']);

        $producto = $resultado['productos'][0];
        $this->assertSame(14676, $producto['unidades_mes_comparado']);
        $this->assertSame(30, $producto['unidades_mes_anterior']);

        // Variación % de Octubre contra Septiembre: ((14676 - 30) / 30) * 100 = 48820.0%
        $this->assertSame(48820.0, $producto['variacion_pct']);

        // Fila Total
        $this->assertSame(14676, $resultado['fila_total']['unidades_mes_comparado']);
        $this->assertSame(30, $resultado['fila_total']['unidades_mes_anterior']);
        $this->assertSame(48820.0, $resultado['fila_total']['variacion_pct']);
    }

    public function test_compara_ultimo_mes_vs_anterior_en_rango_historico_pasado(): void
    {
        // Fecha actual: Noviembre 2026
        Carbon::setTestNow(Carbon::create(2026, 11, 18, 12, 0, 0));

        $mockRepo = Mockery::mock(PedidoProductoRepository::class);

        // Rango pasado cerrado: año 2025 completo
        $productoMock = (object) [
            'id' => 2,
            'nombre' => 'Producto Pasado',
            'sku' => 'SKU-002',
        ];

        $registros = collect([
            (object) [
                'producto_id' => 2,
                'anio' => 2025,
                'mes' => 11,
                'unidades_vendidas' => 100,
                'producto' => $productoMock,
            ],
            (object) [
                'producto_id' => 2,
                'anio' => 2025,
                'mes' => 12,
                'unidades_vendidas' => 150,
                'producto' => $productoMock,
            ],
        ]);

        $mockRepo->shouldReceive('obtenerUnidadesPorProductoYMes')
            ->once()
            ->andReturn($registros);

        $service = new UnidadesVendidasService($mockRepo);

        $resultado = $service->obtenerUnidadesVendidasPorIntervalo([
            'anio' => 2025,
            'mes_desde' => 1,
            'mes_hasta' => 12,
        ]);

        $comparacion = $resultado['periodo']['comparacion'];

        // Al ser 2025 un período cerrado del pasado, compara Diciembre 2025 vs Noviembre 2025
        $this->assertSame('2025-12', $comparacion['mes_actual_clave']);
        $this->assertSame('Dic 2025', $comparacion['mes_actual_etiqueta']);
        $this->assertSame('2025-11', $comparacion['mes_anterior_clave']);
        $this->assertSame('Nov 2025', $comparacion['mes_anterior_etiqueta']);

        $producto = $resultado['productos'][0];
        $this->assertSame(150, $producto['unidades_mes_comparado']);
        $this->assertSame(100, $producto['unidades_mes_anterior']);
        // ((150 - 100) / 100) * 100 = 50.0%
        $this->assertSame(50.0, $producto['variacion_pct']);
    }
}
