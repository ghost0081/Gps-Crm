/*
 * Semantic Button System
 *
 * WHY: The old system had 8+ buttons named by colour (BlackButton, GreenButton, etc.)
 * with no semantic contract. A developer had to guess which one to use for "delete."
 *
 * NEW SYSTEM: 3 intent-based buttons that map directly to user action types:
 *   - PrimaryButton   → The main positive action (Save, Submit, Add, Create)
 *   - DangerButton    → Destructive or irreversible actions (Delete, Remove)
 *   - GhostButton     → Secondary/cancel actions (Cancel, Go Back, No thanks)
 *
 * Legacy colour aliases are preserved below the main system so existing page
 * code continues to work without modification — we just remap them to the
 * correct semantic variants.
 */

import styled from 'styled-components';
import { Button } from '@mui/material';

// ── Intent: Positive Action ────────────────────────────────────────────────
// The highest-contrast, most attention-grabbing button.
// Reserved for the primary next step the user should take.
export const PrimaryButton = styled(Button)`
  && {
    background-color: #1B4F72;
    color: #ffffff;
    font-weight: 600;
    border-radius: 10px;
    padding: 8px 20px;
    transition: background-color 150ms ease, transform 100ms ease, box-shadow 150ms ease;

    &:hover {
      background-color: #154360;
      box-shadow: 0 4px 12px rgba(27, 79, 114, 0.28);
    }

    &:active {
      transform: scale(0.97);
    }

    &:disabled {
      background-color: #E2E8F0;
      color: #94A3B8;
    }
  }
`;

// ── Intent: Destructive Action ─────────────────────────────────────────────
// Only use this when the action cannot be undone (delete, remove, revoke).
// Draws attention through red — not through size or position.
export const DangerButton = styled(Button)`
  && {
    background-color: #EF4444;
    color: #ffffff;
    font-weight: 600;
    border-radius: 8px;
    padding: 8px 20px;
    transition: background-color 150ms ease, transform 100ms ease;

    &:hover {
      background-color: #DC2626;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.30);
    }

    &:active {
      transform: scale(0.97);
    }
  }
`;

// ── Intent: Secondary / Cancel ─────────────────────────────────────────────
// Lowest visual weight. Used alongside a PrimaryButton or DangerButton.
// Gives users an "escape hatch" without competing for attention.
export const GhostButton = styled(Button)`
  && {
    background-color: transparent;
    color: #64748B;
    font-weight: 600;
    border-radius: 8px;
    padding: 8px 20px;
    border: 1px solid #E2E8F0;
    transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;

    &:hover {
      background-color: #F7F8FA;
      border-color: #CBD5E1;
      color: #0F172A;
    }

    &:active {
      transform: scale(0.97);
    }
  }
`;

// ── Intent: Success / Confirm ─────────────────────────────────────────────
// For confirming positive states (mark paid, mark present, approve).
export const SuccessButton = styled(Button)`
  && {
    background-color: #047857;
    color: #ffffff;
    font-weight: 600;
    border-radius: 10px;
    padding: 8px 20px;
    transition: background-color 150ms ease, transform 100ms ease;

    &:hover {
      background-color: #065F46;
      box-shadow: 0 4px 12px rgba(4, 120, 87, 0.28);
    }

    &:active {
      transform: scale(0.97);
    }
  }
`;

// ── Intent: Outlined Primary ───────────────────────────────────────────────
// For secondary actions that need more presence than a GhostButton.
export const OutlinedPrimaryButton = styled(Button)`
  && {
    background-color: transparent;
    color: #1B4F72;
    font-weight: 600;
    border-radius: 10px;
    padding: 8px 20px;
    border: 1.5px solid #1B4F72;
    transition: background-color 150ms ease, color 150ms ease;

    &:hover {
      background-color: #E8F1F8;
    }

    &:active {
      transform: scale(0.97);
    }
  }
`;


// ── Legacy Aliases ─────────────────────────────────────────────────────────
// These map old colour-named buttons to the correct semantic equivalents.
// Existing page code imports these by name and continues to work.
// Migrate page-by-page over time; do NOT add new usages of these names.

/** @deprecated Use PrimaryButton */
export const LightPurpleButton = PrimaryButton;
/** @deprecated Use PrimaryButton */
export const PurpleButton = PrimaryButton;
/** @deprecated Use PrimaryButton */
export const BlueButton = PrimaryButton;
/** @deprecated Use PrimaryButton */
export const IndigoButton = PrimaryButton;
/** @deprecated Use SuccessButton */
export const GreenButton = SuccessButton;
/** @deprecated Use DangerButton */
export const RedButton = DangerButton;
/** @deprecated Use DangerButton */
export const DarkRedButton = DangerButton;
/** @deprecated Use GhostButton */
export const BlackButton = GhostButton;
/** @deprecated Use GhostButton */
export const BrownButton = GhostButton;
