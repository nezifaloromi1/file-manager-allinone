import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { atoms, useTheme, tokens } from '#/flux';
import { isExtensionDropped, splitName, validateName } from '#/core/utils/validate';

/**
 * The name prompt (plan.md §20, §21, §39).
 *
 * Backs both "New folder" and "Rename". It prefills the **full** name, not the
 * stem, because plan.md §20 warns against silently turning `report.pdf` into
 * `report`. Prefilling the stem and re-appending the extension was tried and
 * reverted: "does this input have an extension" is ambiguous, and guessing
 * turned `notes.md` into `notes.md.pdf`.
 *
 * Dropping an extension is allowed but *confirmed*, since that is the one
 * rename that changes a file's type.
 */

export type NameDialogMode = 'create' | 'rename';

export type NameDialogProps = {
  visible: boolean;
  mode: NameDialogMode;
  /** Prefilled value. The full current name in rename mode. */
  initialValue: string;
  title?: string;
  confirmLabel?: string;
  /** Shown under the field; explains the consequence of a specific action. */
  helperText?: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
  /** Rejects a name that already exists in this directory. */
  isTaken?: (name: string) => boolean;
  testID?: string;
};

export function NameDialog({
  visible,
  mode,
  initialValue,
  title,
  confirmLabel,
  helperText,
  onCancel,
  onSubmit,
  isTaken,
  testID = 'nameDialog',
}: NameDialogProps) {
  const t = useTheme();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setValue(initialValue);
    setError(null);
    setConfirmedFor(null);
    // Focus after the modal is on screen; focusing in the same tick can be
    // dropped on Android while the window animates in.
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [initialValue, visible]);

  const droppingExtension = mode === 'rename' && isExtensionDropped(initialValue, value);

  const submit = () => {
    const validation = validateName(value);
    if (!validation.valid) {
      setError(validation.reason);
      return;
    }
    if (isTaken?.(validation.name)) {
      setError('That name is already taken in this folder.');
      return;
    }

    // Two-press confirmation for the one rename that changes a file's type.
    // `confirmedFor` records the exact name the user was warned about, so
    // editing the field afterwards re-arms the warning instead of carrying a
    // stale "yes I meant that" forward.
    if (droppingExtension && confirmedFor !== validation.name) {
      setConfirmedFor(validation.name);
      setError(
        `This will remove the ${splitName(initialValue).extension} extension. Press Rename again to confirm.`,
      );
      return;
    }

    onSubmit(validation.name);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessible={false}>
        {/* Stops a tap inside the sheet from dismissing it. */}
        <Pressable onPress={() => {}} style={[styles.sheet, t.atoms.bg_card]} accessible={false}>
          <View style={[atoms.p_lg, atoms.gap_md]} testID={testID}>
            <Text style={[atoms.text_lg, atoms.font_medium, t.atoms.text]}>
              {title ?? (mode === 'create' ? 'New folder' : 'Rename')}
            </Text>

            {helperText ? (
              <Text style={[atoms.text_xs, t.atoms.text_contrast_medium]}>{helperText}</Text>
            ) : null}

            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={(next) => {
                setValue(next);
                // Clear the error as soon as the user edits, rather than making
                // them resubmit to discover it is gone.
                if (error) setError(null);
                // Any edit re-arms the extension warning.
                setConfirmedFor(null);
              }}
              onSubmitEditing={submit}
              autoCapitalize="none"
              autoCorrect={false}
              selectTextOnFocus={mode === 'rename'}
              returnKeyType="done"
              accessibilityLabel={mode === 'create' ? 'Folder name' : 'New name'}
              accessibilityHint="Enter a name without slashes"
              testID={`${testID}.input`}
              style={[
                atoms.p_md,
                atoms.rounded_sm,
                atoms.text_md,
                t.atoms.text,
                t.atoms.bg,
                t.atoms.border_contrast_medium,
                atoms.border,
                styles.input,
                error ? t.atoms.text_error : null,
              ]}
            />

            {error ? (
              <Text
                style={[atoms.text_xs, t.atoms.text_error]}
                accessibilityLiveRegion="polite"
                testID={`${testID}.error`}
              >
                {error}
              </Text>
            ) : null}

            <View style={[atoms.flex_row, atoms.gap_sm, atoms.justify_end]}>
              <DialogButton label="Cancel" onPress={onCancel} testID={`${testID}.cancel`} />
              <DialogButton
                label={confirmLabel ?? (mode === 'create' ? 'Create' : 'Rename')}
                onPress={submit}
                primary
                testID={`${testID}.confirm`}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DialogButton({
  label,
  onPress,
  primary = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  testID?: string;
}) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [
        atoms.px_lg,
        atoms.rounded_xs,
        atoms.align_center,
        atoms.justify_center,
        styles.dialogButton,
        primary ? t.atoms.bg_accent : t.atoms.bg_contrast_50,
        !primary && t.atoms.border_contrast_low,
        !primary && atoms.border,
        pressed && styles.pressed,
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
    // Flat, per design.md — depth comes from the scrim, not a shadow.
    overflow: 'hidden',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  input: {
    minHeight: tokens.touchTarget.comfortable,
  },
  dialogButton: {
    minHeight: tokens.touchTarget.comfortable,
    minWidth: 88,
  },
  pressed: {
    opacity: 0.75,
  },
} as const;
