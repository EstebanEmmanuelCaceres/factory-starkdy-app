<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EtapaProductoResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'producto_id' => $this->producto_id,
            'etapa_id' => $this->etapa_id,
            'orden' => $this->orden,
            'etapa' => new EtapaResource($this->whenLoaded('etapa')),
            'dependencias' => EtapaProductoResource::collection($this->whenLoaded('dependencias')),
        ];
    }
}
