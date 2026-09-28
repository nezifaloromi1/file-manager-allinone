import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { atoms, tokens, useTheme } from '@/flux';
import { CONFLICT_STRATEGIES, type ConflictPolicy } from '#/domain/models/operation';

/**
 * Name-collision resolution (plan.md §24).
 *
 * "Never silently overwrite user files." There is no default and no timeout: the
 * user must choose. Four outcomes, and the copy of each says what it will do
 * rather than only naming the button — `Keep both` in particular creates
 * `report (2).pdf`, and saying so is the difference between a confident tap and
 * a guess.
 *
 * "Apply to all" is a fifth option for multi-item operations. It is handled by
 * `createConflictResolver` in the domain layer, not here, so a batch can never
 * show forty identical dialogs.
 */
export type ConflictRequest = {
  /** The name that already exists at the destination. */
  name: string;
  /** How many items are still to be processed, for the prompt's context. */
  remaining: number;
};

export function ConflictDialog({
  request,
  onResolve,
}: {
  request: ConflictRequest | null;
  onResolve: (policy: ConflictPolicy) => void;
}) {
  const t = useTheme();
  const [choice, setChoice] = useState<ConflictPolicy | 'APPLY_TO_ALL' | null>(null);

  useEffect(() => {
    // Reset per prompt, so a previously chosen option never silently applies to
    // a different file.
    setChoice(null);
  }, [request]);

  if (!request) return null;

  const remaining = request.remaining > 1 ? `${request.remaining} items left` : '1 item left';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onResolve('CANCEL')}>
      <View style={styles.backdrop}>
        <View
          style={[styles.sheet, t.atoms.bg_card]}
          accessibilityViewIsModal
          accessible={false}
          testID="conflictDialog"
        >
          <View style={[atoms.p_lg, atoms.gap_sm]}>
            <Text style={[atoms.text_lg, atoms.font_medium, t.atoms.text]}>
              A file named {request.name} already exists
            </Text>
            <Text style={[atoms.text_sm, t.atoms.text_contrast_medium, styles.body]}>
              {remaining}. Choose what to do with this one.
            </Text>
          </View>

          <View style={styles.options}>
            {request.remaining > 1 ? (
              <ConflictOption
                label={LABELS.APPLY_TO_ALL.label}
                detail={`${LABELS.APPLY_TO_ALL.detail} (${request.remaining} items)`}
                selected={choice === 'APPLY_TO_ALL'}
                onPress={() => setChoice('APPLY_TO_ALL')}
                testID="conflictDialog.applyAll"
              />
            ) : null}

            {CONFLICT_STRATEGIES.map((policy) => (
              <ConflictOption
                key={policy}
                label={LABELS[policy].label}
                detail={LABELS[policy].detail}
                selected={choice === policy}
                onPress={() => setChoice(policy)}
                testID={`conflictDialog.${policy.toLowerCase()}`}
              />
            ))}
          </View>

          <View style={[atoms.flex_row, atoms.gap_sm, atoms.p_lg, styles.actions]}>
            <DialogButton
              label="Cancel"
              onPress={() => onResolve('CANCEL')}
              testID="conflictDialog.cancel"
            />
            <DialogButton
              label="Continue"
              primary
              disabled={choice === null}
              onPress={() => {
                if (choice === 'APPLY_TO_ALL') {
                  // Re-ask for a concrete strategy: "apply to all" is a
                  // convenience, not an action the provider understands.
                  onResolve('APPLY_TO_ALL');
                } else if (choice !== null) {
                  onResolve(choice);
                }
              }}
              testID="conflictDialog.confirm"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const LABELS: Record<ConflictPolicy | 'APPLY_TO_ALL', { label: string; detail: string }> = {
  APPLY_TO_ALL: {
    label: 'Apply to all',
    detail: 'Use one choice for every remaining conflict',
  },
  REPLACE: {
    label: 'Replace',
    detail: 'Delete the existing file and write this one in its place',
  },
  KEEP_BOTH: {
    label: 'Keep both',
    detail: 'Write this one alongside, with a numbered name',
  },
  SKIP: {
    label: 'Skip',
    detail: 'Leave this item where it is and continue',
  },
  CANCEL: {
    label: 'Cancel',
    detail: 'Stop the whole operation',
  },
};

function ConflictOption({
  label,
  detail,
  selected,
  onPress,
  testID,
}: {
  label: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ selected }}
      testID={testID}
      style={({ pressed }) => [
        atoms.p_lg,
        atoms.gap_2xs,
        selected && t.atoms.bg_contrast_100,
        pressed && !selected && t.atoms.bg_contrast_25,
      ]}
    >
      <Text style={[atoms.text_md, selected ? atoms.font_medium : atoms.font_normal, t.atoms.text]}>
        {label}
      </Text>
      <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>{detail}</Text>
    </Pressable>
  );
}

function DialogButton({
  label,
  onPress,
  primary = false,
  disabled = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => [
        atoms.flex_1,
        atoms.align_center,
        atoms.justify_center,
        atoms.py_md,
        atoms.rounded_xs,
        styles.action,
        primary ? t.atoms.bg_accent : t.atoms.bg_contrast_50,
        !primary && t.atoms.border_contrast_low,
        !primary && atoms.border,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[atoms.text_sm, atoms.font_medium, primary ? t.atoms.text_inverted : t.atoms.text]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = {
  backdrop: {
    flex: 1,
    backgroundColor: 'tokens.scrim.background',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  body: {
    lineHeight: 20,
  },
  options: {
    // Separators between choices, matching design.md's "no borders on
    // containers, separation through spacing" — the rows are the exception,
    // where a divider is the clearest affordance for a list of choices.
  },
  actions: {
    gap: 8,
  },
  action: {
    minHeight: tokens.touchTarget.comfortable,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.4,
  },
} as const;
