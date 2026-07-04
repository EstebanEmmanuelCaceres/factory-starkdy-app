# Migraciones de Laravel Generadas Hoy — 02/07/2026

Hoy se generaron y ordenaron secuencialmente un total de **17 archivos de migración** para establecer la base de datos PostgreSQL del Sistema Kanban de la Fábrica, incluyendo la reestructuración a una relación de muchos a muchos (N a N) para Productos y Pedidos.

---

## Índice de Migraciones

1. [2026_07_02_000001_create_roles_table.php](#1-create_roles_table)
2. [2026_07_02_000002_create_users_table.php](#2-create_users_table)
3. [2026_07_02_000003_create_responsabilidades_table.php](#3-create_responsabilidades_table)
4. [2026_07_02_000004_create_user_responsabilidades_table.php](#4-create_user_responsabilidades_table)
5. [2026_07_02_000005_create_clientes_table.php](#5-create_clientes_table)
6. [2026_07_02_000006_create_datos_cliente_table.php](#6-create_datos_cliente_table)
7. [2026_07_02_000007_create_comentarios_cliente_table.php](#7-create_comentarios_cliente_table)
8. [2026_07_02_000008_create_pedidos_table.php](#8-create_pedidos_table)
9. [2026_07_02_000009_create_pedido_historial_cambios_table.php](#9-create_pedido_historial_cambios_table)
10. [2026_07_02_000010_create_pedido_historial_estado_table.php](#10-create_pedido_historial_estado_table)
11. [2026_07_02_000011_create_comentarios_pedido_table.php](#11-create_comentarios_pedido_table)
12. [2026_07_02_000012_create_productos_table.php](#12-create_productos_table)
13. [2026_07_02_000013_create_etapas_table.php](#13-create_etapas_table)
14. [2026_07_02_000014_create_etapa_operarios_table.php](#14-create_etapa_operarios_table)
15. [2026_07_02_200000_make_productos_many_to_many_with_pedidos.php](#15-make_productos_many_to_many_with_pedidos)
16. [2026_07_02_000018_create_etapa_responsabilidades_table.php](#16-create_etapa_responsabilidades_table)
17. [2026_07_02_000019_create_etapa_historial_estado_table.php](#17-create_etapa_historial_estado_table)

---

## Detalle y Código de los Archivos

### 1. `create_roles_table`
**Archivo:** [2026_07_02_000001_create_roles_table.php](file:///f:/cosas-de-Emma/factory-app/backend/laravel/database/migrations/2026_07_02_000001_create_roles_table.php)
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('roles');
    }
};
```

---

### 2. `create_users_table`
**Archivo:** [2026_07_02_000002_create_users_table.php](file:///f:/cosas-de-Emma/factory-app/backend/laravel/database/migrations/2026_07_02_000002_create_users_table.php)
*Nota: Se incluye `role_id` como relación de 1 a N directamente en la tabla users, y se mantienen las tablas de tokens de contraseña y sesiones requeridas por Laravel.*
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->foreignId('role_id')->constrained('roles')->restrictOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
```

---

### 3. `create_responsabilidades_table`
**Archivo:** [2026_07_02_000003_create_responsabilidades_table.php](file:///f:/cosas-de-Emma/factory-app/backend/laravel/database/migrations/2026_07_02_000003_create_responsabilidades_table.php)
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('responsabilidades', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->text('descripcion')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('responsabilidades');
    }
};
```

---

### 4. `create_user_responsabilidades_table`
**Archivo:** [2026_07_02_000004_create_user_responsabilidades_table.php](file:///f:/cosas-de-Emma/factory-app/backend/laravel/database/migrations/2026_07_02_000004_create_user_responsabilidades_table.php)
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_responsabilidades', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('responsabilidad_id')->constrained('responsabilidades')->cascadeOnDelete();
            $table->unique(['user_id', 'responsabilidad_id']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_responsabilidades');
    }
};
```

---

### 5. `create_clientes_table`
**Archivo:** [2026_07_02_000005_create_clientes_table.php](file:///f:/cosas-de-Emma/factory-app/backend/laravel/database/migrations/2026_07_02_000005_create_clientes_table.php)
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clientes', function (Blueprint $table) {
            $table->id();
            $table->string('razon_social');
            $table->string('email')->nullable();
            $table->string('telefono')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clientes');
    }
};
```

---

### 6. `create_datos_cliente_table`
**Archivo:** [2026_07_02_000006_create_datos_cliente_table.php](file:///f:/cosas-de-Emma/factory-app/backend/laravel/database/migrations/2026_07_02_000006_create_datos_cliente_table.php)
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('datos_cliente', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('clientes')->cascadeOnDelete();
            $table->string('clave');
            $table->text('valor')->nullable();
            $table->timestamps();
            $table->unique(['cliente_id', 'clave']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('datos_cliente');
    }
};
```

---

### 7. `create_comentarios_cliente_table`
**Archivo:** [2026_07_02_000007_create_comentarios_cliente_table.php](file:///f:/cosas-de-Emma/factory-app/backend/laravel/database/migrations/2026_07_02_000007_create_comentarios_cliente_table.php)
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comentarios_cliente', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('clientes')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->text('cuerpo');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comentarios_cliente');
    }
};
```

---

### 8. `create_pedidos_table`
**Archivo:** [2026_07_02_000008_create_pedidos_table.php](file:///f:/cosas-de-Emma/factory-app/backend/laravel/database/migrations/2026_07_02_000008_create_pedidos_table.php)
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pedidos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('clientes')->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('codigo')->unique();
            $table->string('estado')->default('pendiente');
            $table->string('prioridad')->default('normal');
            $table->date('fecha_entrega')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pedidos');
    }
};
```

---

### 9. `create_pedido_historial_cambios_table`
**Archivo:** [2026_07_02_000009_create_pedido_historial_cambios_table.php](file:///f:/cosas-de-Emma/factory-app/backend/laravel/database/migrations/2026_07_02_000009_create_pedido_historial_cambios_table.php)
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pedido_historial_cambios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_id')->constrained('pedidos')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->string('campo');
            $table->text('valor_anterior')->nullable();
            $table->text('valor_nuevo')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pedido_historial_cambios');
    }
};
```

---

### 10. `create_pedido_historial_estado_table`
**Archivo:** [2026_07_02_000010_create_pedido_historial_estado_table.php](file:///f:/cosas-de-Emma/factory-app/backend/laravel/database/migrations/2026_07_02_000010_create_pedido_historial_estado_table.php)
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pedido_historial_estado', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_id')->constrained('pedidos')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->string('estado_anterior')->nullable();
            $table->string('estado_nuevo');
            $table->text('comentario')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pedido_historial_estado');
    }
};
```

---

### 11. `create_comentarios_pedido_table`
**Archivo:** [2026_07_02_000011_create_comentarios_pedido_table.php](file:///f:/cosas-de-Emma/factory-app/backend/laravel/database/migrations/2026_07_02_000011_create_comentarios_pedido_table.php)
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comentarios_pedido', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_id')->constrained('pedidos')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->text('cuerpo');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comentarios_pedido');
    }
};
```

---

### 12. `create_productos_table`
**Archivo:** [2026_07_02_000012_create_productos_table.php](file:///f:/cosas-de-Emma/factory-app/backend/laravel/database/migrations/2026_07_02_000012_create_productos_table.php)
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('productos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_id')->constrained('pedidos')->cascadeOnDelete();
            $table->string('nombre');
            $table->string('sku')->nullable();
            $table->unsignedInteger('cantidad')->default(1);
            $table->text('descripcion')->nullable();
            $table->string('estado')->default('pendiente');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('productos');
    }
};
```

---

### 13. `create_etapas_table`
**Archivo:** [2026_07_02_000013_create_etapas_table.php](file:///f:/cosas-de-Emma/factory-app/backend/laravel/database/migrations/2026_07_02_000013_create_etapas_table.php)
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('etapas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('producto_id')->constrained('productos')->cascadeOnDelete();
            $table->string('nombre');
            $table->unsignedSmallInteger('posicion')->default(0);
            $table->string('estado')->default('pendiente');
            $table->date('fecha_inicio')->nullable();
            $table->date('fecha_fin')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etapas');
    }
};
```

---

### 14. `create_etapa_operarios_table`
**Archivo:** [2026_07_02_000014_create_etapa_operarios_table.php](file:///f:/cosas-de-Emma/factory-app/backend/laravel/database/migrations/2026_07_02_000014_create_etapa_operarios_table.php)
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('etapa_operarios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('etapa_id')->constrained('etapas')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->timestamp('asignado_at')->useCurrent();
            $table->unique(['etapa_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etapa_operarios');
    }
};
```

---

### 15. `make_productos_many_to_many_with_pedidos`
**Archivo:** [2026_07_02_200000_make_productos_many_to_many_with_pedidos.php](file:///f:/cosas-de-Emma/factory-app/backend/laravel/database/migrations/2026_07_02_200000_make_productos_many_to_many_with_pedidos.php)
*Nota: Modifica la tabla `productos` para remover la clave `pedido_id` y crea la tabla intermedia `pedido_productos` para la relación muchos a muchos.*
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('productos', function (Blueprint $table) {
            $table->dropForeign(['pedido_id']);
            $table->dropColumn('pedido_id');
        });

        Schema::create('pedido_productos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_id')->constrained('pedidos')->cascadeOnDelete();
            $table->foreignId('producto_id')->constrained('productos')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['pedido_id', 'producto_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pedido_productos');

        Schema::table('productos', function (Blueprint $table) {
            $table->foreignId('pedido_id')->constrained('pedidos')->cascadeOnDelete();
        });
    }
};

---

### 16. `create_etapa_responsabilidades_table`
**Archivo:** [2026_07_02_000018_create_etapa_responsabilidades_table.php](file:///f:/cosas-de-Emma/factory-app/backend/laravel/database/migrations/2026_07_02_000018_create_etapa_responsabilidades_table.php)
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('etapa_responsabilidades', function (Blueprint $table) {
            $table->id();
            $table->foreignId('etapa_id')->constrained('etapas')->cascadeOnDelete();
            $table->foreignId('responsabilidad_id')->constrained('responsabilidades')->cascadeOnDelete();
            $table->unique(['etapa_id', 'responsabilidad_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etapa_responsabilidades');
    }
};
```

---

### 17. `create_etapa_historial_estado_table`
**Archivo:** [2026_07_02_000019_create_etapa_historial_estado_table.php](file:///f:/cosas-de-Emma/factory-app/backend/laravel/database/migrations/2026_07_02_000019_create_etapa_historial_estado_table.php)
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('etapa_historial_estado', function (Blueprint $table) {
            $table->id();
            $table->foreignId('etapa_id')->constrained('etapas')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('estado_anterior')->nullable();
            $table->string('estado_nuevo');
            $table->text('comentario')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etapa_historial_estado');
    }
};
```
```
