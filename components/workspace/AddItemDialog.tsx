"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type AddItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  fieldLabel: string;
  fieldId: string;
  placeholder: string;
  /** 編集モード時に初期値として表示するテキスト */
  defaultValue?: string;
  onAdd: (name: string) => void;
};

export function AddItemDialog({
  open,
  onOpenChange,
  title,
  description,
  fieldLabel,
  fieldId,
  placeholder,
  defaultValue,
  onAdd,
}: AddItemDialogProps) {
  const [name, setName] = useState(defaultValue ?? "");

  // ダイアログが開くたびに初期値をセット
  useEffect(() => {
    if (open) setName(defaultValue ?? ""); // eslint-disable-line react-hooks/set-state-in-effect
  }, [open, defaultValue]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName("");
    onOpenChange(false);
  };

  const isEditMode = defaultValue !== undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setName(defaultValue ?? "");
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={fieldId}>{fieldLabel}</FieldLabel>
            <Input
              id={fieldId}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder={placeholder}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">キャンセル</Button>} />
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {isEditMode ? "保存" : "追加"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
