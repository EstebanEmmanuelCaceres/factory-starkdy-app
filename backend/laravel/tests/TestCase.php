<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        if (! $this->app) {
            $this->refreshApplication();
        }

        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => database_path('database_test.sqlite'),
        ]);

        parent::setUp();
    }
}
