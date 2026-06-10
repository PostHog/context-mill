<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'email',
        'password',
        'is_staff',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_staff' => 'boolean',
        ];
    }

    /**
     * Get PostHog person properties for this user.
     */
    public function getPostHogProperties(): array
    {
        return [
            'email' => $this->email,
            'is_staff' => $this->is_staff,
            'date_joined' => $this->created_at->toISOString(),
        ];
    }
}
