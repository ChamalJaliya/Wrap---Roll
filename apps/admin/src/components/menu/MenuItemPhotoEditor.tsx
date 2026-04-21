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
      <div className="mt-7 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 p-5 sm:p-6">
        <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">Item photo</h4>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Shown on the customer menu and checkout. One primary image - paste a secure (
          <span className="font-mono">https</span>) image link.
        </p>

        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex shrink-0 justify-center lg:w-[200px]">
            <div className="relative flex h-40 w-full max-w-[200px] items-center justify-center overflow-hidden rounded-xl border bg-white shadow-sm lg:h-44">
              {imageUrl && !previewBroken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="Menu item preview"
                  className="h-full w-full object-cover"
                  onError={() => setPreviewBroken(true)}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 p-4 text-center text-muted-foreground">
                  <ImageIcon className="h-10 w-10 opacity-40" />
                  <span className="text-xs font-medium">No preview yet</span>
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={urlInputId} className="flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 opacity-70" /> Image URL
              </Label>
              <Input
                id={urlInputId}
                type="url"
                placeholder="https://…"
                className="h-11 bg-white"
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
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {imageUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 text-destructive hover:text-destructive"
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
