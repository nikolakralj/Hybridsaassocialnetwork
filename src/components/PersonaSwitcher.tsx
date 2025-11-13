import React from 'react';
import { usePersona, TEST_PERSONAS, TestPersona } from '../contexts/PersonaContext';
import { User, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';

/**
 * 🧪 TEST MODE ONLY - Persona Switcher
 * 
 * Allows switching between test personas to validate approval flows.
 * Will be REMOVED in Phase 9 when real auth is implemented.
 */

export function PersonaSwitcher() {
  const { currentPersona, setPersona } = usePersona();

  if (!currentPersona) return null;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'contractor':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'manager':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'client':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Test Mode Indicator */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
        <span className="text-sm text-amber-700">Test Mode</span>
      </div>

      {/* Persona Switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <User className="w-4 h-4" />
            <div className="flex flex-col items-start">
              <span className="text-sm">{currentPersona.name}</span>
              <span className="text-xs text-muted-foreground capitalize">
                {currentPersona.role}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Switch Persona (Test Mode)
          </div>
          <DropdownMenuSeparator />
          {TEST_PERSONAS.map((persona) => (
            <DropdownMenuItem
              key={persona.id}
              onClick={() => setPersona(persona)}
              className="flex items-center gap-3 py-3 cursor-pointer"
            >
              <User className="w-4 h-4" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span>{persona.name}</span>
                  {currentPersona.id === persona.id && (
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{persona.email}</div>
              </div>
              <div
                className={`px-2 py-0.5 text-xs rounded border capitalize ${getRoleBadgeColor(
                  persona.role
                )}`}
              >
                {persona.role}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
