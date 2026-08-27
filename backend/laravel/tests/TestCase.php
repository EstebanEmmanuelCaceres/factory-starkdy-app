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

        $testDb = database_path('database_test.sqlite');
        if (!file_exists($testDb)) {
            @touch($testDb);
        }

        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => $testDb,
        ]);

        parent::setUp();
    }
}
