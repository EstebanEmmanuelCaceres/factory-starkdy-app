<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * Listar todos los usuarios con sus roles y opciones de filtrado.
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::with('role');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('role_id')) {
            $query->where('role_id', $request->input('role_id'));
        }

        $users = $query->orderBy('name', 'asc')->get();

        return response()->json([
            'users' => $users->map(fn ($user) => $this->formatUser($user)),
        ]);
    }

    /**
     * Obtener el catálogo de roles disponibles.
     */
    public function roles(): JsonResponse
    {
        $roles = Role::orderBy('name', 'asc')->get();

        return response()->json([
            'roles' => $roles->map(fn ($role) => [
                'id'   => $role->id,
                'slug' => $role->slug,
                'name' => $role->name,
            ]),
        ]);
    }

    /**
     * Registrar a un nuevo usuario (Creado por el Admin).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role_id'  => ['required', 'integer', 'exists:roles,id'],
        ], [
            'name.required'     => 'El nombre es obligatorio.',
            'email.required'    => 'El correo electrónico es obligatorio.',
            'email.email'       => 'El formato del correo no es válido.',
            'email.unique'      => 'Este correo electrónico ya está registrado.',
            'password.required' => 'La contraseña es obligatoria.',
            'password.min'      => 'La contraseña debe tener al menos 8 caracteres.',
            'role_id.required'  => 'El rol es obligatorio.',
            'role_id.exists'    => 'El rol seleccionado no es válido.',
        ]);

        $user = User::create([
            'name'     => $validated['name'],
            'email'    => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role_id'  => $validated['role_id'],
        ]);

        $user->load('role');

        return response()->json([
            'message' => 'Usuario creado correctamente.',
            'user'    => $this->formatUser($user),
        ], 201);
    }

    /**
     * Obtener el detalle de un usuario por su ID.
     */
    public function show(int $id): JsonResponse
    {
        $user = User::with('role')->findOrFail($id);

        return response()->json([
            'user' => $this->formatUser($user),
        ]);
    }

    /**
     * Actualizar la información básica de un usuario (Nombre, Email, Rol).
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name'    => ['required', 'string', 'max:255'],
            'email'   => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'role_id' => ['nullable', 'integer', 'exists:roles,id'],
        ], [
            'name.required'  => 'El nombre es obligatorio.',
            'email.required' => 'El correo electrónico es obligatorio.',
            'email.email'    => 'El formato del correo no es válido.',
            'email.unique'   => 'Este correo electrónico ya pertenece a otro usuario.',
            'role_id.exists' => 'El rol seleccionado no es válido.',
        ]);

        $updateData = [
            'name'  => $validated['name'],
            'email' => $validated['email'],
        ];

        if (isset($validated['role_id'])) {
            $updateData['role_id'] = $validated['role_id'];
        }

        $user->update($updateData);

        $user->load('role');

        return response()->json([
            'message' => 'Usuario actualizado correctamente.',
            'user'    => $this->formatUser($user),
        ]);
    }

    /**
     * Cambiar el rol de un usuario.
     */
    public function changeRole(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'role_id' => ['required', 'integer', 'exists:roles,id'],
        ], [
            'role_id.required' => 'El rol es obligatorio.',
            'role_id.exists'   => 'El rol seleccionado no es válido.',
        ]);

        $user->update([
            'role_id' => $validated['role_id'],
        ]);

        $user->load('role');

        return response()->json([
            'message' => "Rol de {$user->name} actualizado a {$user->role?->name} correctamente.",
            'user'    => $this->formatUser($user),
        ]);
    }

    /**
     * Cambiar la contraseña de un usuario.
     */
    public function changePassword(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'password' => ['required', 'string', 'min:8'],
        ], [
            'password.required' => 'La nueva contraseña es obligatoria.',
            'password.min'      => 'La contraseña debe tener al menos 8 caracteres.',
        ]);

        $user->update([
            'password' => Hash::make($validated['password']),
        ]);

        return response()->json([
            'message' => "Contraseña de {$user->name} actualizada correctamente.",
        ]);
    }

    /**
     * Eliminar un usuario.
     */
    public function destroy(int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        if ($user->id === Auth::id()) {
            return response()->json([
                'message' => 'No puedes eliminar tu propia cuenta de usuario.',
            ], 422);
        }

        $user->delete();

        return response()->json([
            'message' => 'Usuario eliminado correctamente.',
        ]);
    }

    /**
     * Formatear el objeto usuario para la respuesta JSON.
     */
    private function formatUser(User $user): array
    {
        return [
            'id'         => $user->id,
            'name'       => $user->name,
            'email'      => $user->email,
            'role'       => $user->role?->slug,
            'role_id'    => $user->role_id,
            'role_label' => $user->role?->name ?? 'Sin Rol',
            'created_at' => $user->created_at?->toIso8601String() ?? $user->created_at?->toDateString(),
        ];
    }
}
