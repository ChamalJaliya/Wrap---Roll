'use client';

import React, { forwardRef, useEffect, useId, useImperativeHandle, useState } from 'react';
import { ImageIcon, Link2, Trash2 } from 'lucide-react';
import { Button, Input, Label } from '@wrap-roll/shared-ui';
import { isMenuItemImageUrl, MENU_ITEM_IMAGE_URL_MAX_LEN } from '@wrap-roll/contracts';

export type MenuItemPhotoEditorProps = {
  imageUrl: string | undefined;
  onChange: (next: string | undefined) => void;
  onClientError?: (message: string | null) => void;
};

export type MenuItemPhotoEditorHandle = {
  /** Applies the URL field and returns the value to send to the API, or an error message. */
  prepareSave: () => { imageUrl: string | null } | { error: string };
};

export const MenuItemPhotoEditor = forwardRef<MenuItemPhotoEditorHandle, MenuItemPhotoEditorProps>(
  function MenuItemPhotoEditor({ imageUrl, onChange, onClientError }, ref) {
    const urlInputId = useId();
    const [previewBroken, setPreviewBroken] = useState(false);
    const [urlDraft, setUrlDraft] = useState('');

    const fromFile = Boolean(imageUrl?.startsWith('data:'));

    useEffect(() => {
      if (imageUrl?.startsWith('data:')) setUrlDraft('');
      else setUrlDraft(imageUrl ?? '');
    }, [imageUrl]);

    const commitUrlFromDraft = () => {
      const t = urlDraft.trim();
      if (!t) {
        if (!imageUrl?.startsWith('data:')) {
          onChange(undefined);
          onClientError?.(null);
        }
        return;
      }
      if (t.length > MENU_ITEM_IMAGE_URL_MAX_LEN) {
        onClientError?.(`URL or image data is too long (max ${Math.round(MENU_ITEM_IMAGE_URL_MAX_LEN / 1_000_000)}M characters).`);
        return;
      }
      if (!isMenuItemImageUrl(t)) {
        onClientError?.('Use an https image URL, or upload a PNG / JPEG / GIF / WebP file.');
        return;
      }
      onChange(t);
      onClientError?.(null);
      setPreviewBroken(false);
    };

    useImperativeHandle(
      ref,
      () => ({
        prepareSave: (): { imageUrl: string | null } | { error: string } => {
          if (imageUrl?.startsWith('data:')) {
            return { imageUrl };
          }
          const t = urlDraft.trim();
          if (!t) {
            onChange(undefined);
            return { imageUrl: null };
          }
          if (t.length > MENU_ITEM_IMAGE_URL_MAX_LEN) {
            return {
              error: `Image URL or data is too long (max ${Math.round(MENU_ITEM_IMAGE_URL_MAX_LEN / 1_000_000)}M characters).`,
            };
          }
          if (!isMenuItemImageUrl(t)) {
            return { error: 'Use an https image URL, or upload a PNG / JPEG / GIF / WebP file.' };
          }
          onChange(t);
          return { imageUrl: t };
        },
      }),
      [imageUrl, urlDraft, onChange],
    );

    return (
      <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-3 sm:p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Photo</h4>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          Optional — paste an <span className="font-mono">https</span> image URL for menu & checkout.
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex shrink-0 justify-center sm:justify-start">
            <div className="relative flex h-[104px] w-[104px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background shadow-sm">
              {imageUrl && !previewBroken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="Menu item preview"
                  className="h-full w-full object-cover"
                  onError={() => setPreviewBroken(true)}
                />
              ) : (
                <div className="flex flex-col items-center gap-1 p-2 text-center text-muted-foreground">
                  <ImageIcon className="h-7 w-7 opacity-40" />
                  <span className="text-[10px] font-medium">No image</span>
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={urlInputId} className="flex items-center gap-1.5 text-xs">
                <Link2 className="h-3 w-3 opacity-70" /> Image URL
              </Label>
              <Input
                id={urlInputId}
                type="url"
                placeholder="https://…"
                className="h-9 bg-background"
                value={urlDraft}
                onChange={(e) => {
                  setUrlDraft(e.target.value);
                  onClientError?.(null);
                }}
                onBlur={commitUrlFromDraft}
              />
              {fromFile ? (
                <p className="text-xs text-muted-foreground">
                Showing an existing local image value. Add a URL above to switch to a hosted image.
                </p>
              ) : null}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {imageUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-destructive hover:text-destructive"
                  onClick={() => {
                    onChange(undefined);
                    onClientError?.(null);
                    setPreviewBroken(false);
                  }}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Remove photo
                </Button>
              ) : null}
            </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
