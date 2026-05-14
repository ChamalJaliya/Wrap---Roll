'use client';

import React, { useEffect, useState } from 'react';
import { CustomerApiService } from '@/services/api';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  FormToggleRow,
  InlineFormPanel,
  Input,
  Label,
} from '@wrap-roll/shared-ui';
import type { CustomerAddress, SavedPaymentToken } from '@wrap-roll/contracts';
import { cn } from '@/lib/utils';
import { surfaceInputClass } from '@/lib/client-field-styles';
import {
  emptyAddressForm,
  emptyCardForm,
  isAddressFormValid,
  isCardFormValid,
  profileCheckboxLabelClass,
  profileDefaultBadgeClass,
  profileInlineFormPanelClass,
  toAddressDraftPayload,
  toAddressForm,
  toCardDraftPayload,
  toCardForm,
  type AddressForm,
  type CardForm,
} from '@/lib/client-profile-contract';
import {
  clientAccountStackClass,
  clientContentWideClass,
  clientElevatedCardClass,
  clientElevatedCardHeaderClass,
  clientFormLabelClass,
  clientPageShellClass,
  clientSectionTitleClass,
} from '@/lib/client-page-shell';

function ProfileLoadingSkeleton() {
  return (
    <div
      className={cn(clientPageShellClass, 'overflow-hidden')}
      role="status"
      aria-live="polite"
      aria-label="Loading account settings"
    >
      <div className={clientContentWideClass}>
        <div className={clientAccountStackClass}>
          <div className="relative h-56 overflow-hidden rounded-3xl border border-neutral-800/30 bg-gradient-to-br from-neutral-900 to-neutral-950 sm:h-64">
            <div className="space-y-4 p-8">
              <div className="h-3 w-24 animate-pulse rounded bg-white/15" />
              <div className="h-10 max-w-sm animate-pulse rounded-lg bg-white/12" />
              <div className="h-4 max-w-xl animate-pulse rounded bg-white/10" />
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-[4.75rem] animate-pulse rounded-2xl bg-white/10" />
                ))}
              </div>
            </div>
          </div>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-3xl border border-neutral-200/60 bg-neutral-100/50 sm:h-52"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [savedCards, setSavedCards] = useState<SavedPaymentToken[]>([]);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [addressForm, setAddressForm] = useState<AddressForm>(emptyAddressForm);
  const [cardForm, setCardForm] = useState<CardForm>(emptyCardForm);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [notice, setNotice] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const getErrorMessage = (error: unknown, fallback: string): string => {
    if (
      error &&
      typeof error === 'object' &&
      'response' in error &&
      (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
    ) {
      return String((error as { response?: { data?: { message?: unknown } } }).response?.data?.message);
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  };

  const loadData = async () => {
    try {
      const [profileRes, addressBookRes, savedCardsRes] = await Promise.all([
        CustomerApiService.getProfile().catch(() => null),
        CustomerApiService.getAddressBook().catch(() => []),
        CustomerApiService.getSavedCards().catch(() => []),
      ]);
      const profileData = profileRes ?? null;
      setProfileName(String(profileData?.name ?? ''));
      setProfilePhone(String(profileData?.phone ?? ''));
      setAddresses(Array.isArray(addressBookRes) ? addressBookRes : []);
      setSavedCards(Array.isArray(savedCardsRes) ? savedCardsRes : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    setNotice('');
    try {
      const data = await CustomerApiService.updateProfile({
        name: profileName.trim(),
        phone: profilePhone.trim(),
      });
      setProfileName(String(data?.name ?? profileName));
      setProfilePhone(String(data?.phone ?? profilePhone));
      setNotice('Profile updated.');
    } catch (error) {
      setNotice(getErrorMessage(error, 'Failed to update profile.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const saveAddress = async () => {
    if (!isAddressFormValid(addressForm)) {
      setNotice('Label, address line 1, and city are required.');
      return;
    }
    setSavingAddress(true);
    setNotice('');
    try {
      await CustomerApiService.saveAddress(toAddressDraftPayload(addressForm));
      setAddressForm(emptyAddressForm);
      await loadData();
      setNotice('Address saved.');
    } catch (error) {
      setNotice(getErrorMessage(error, 'Failed to save address.'));
    } finally {
      setSavingAddress(false);
    }
  };

  const saveCard = async () => {
    if (!isCardFormValid(cardForm)) {
      setNotice('Card token, brand, and last 4 digits are required.');
      return;
    }
    setSavingCard(true);
    setNotice('');
    try {
      await CustomerApiService.saveCard(toCardDraftPayload(cardForm));
      setCardForm(emptyCardForm);
      await loadData();
      setNotice('Saved card updated.');
    } catch (error) {
      setNotice(getErrorMessage(error, 'Failed to save card.'));
    } finally {
      setSavingCard(false);
    }
  };

  if (loading) {
    return <ProfileLoadingSkeleton />;
  }

  return (
    <div className={cn(clientPageShellClass, 'overflow-hidden')}>
      <div className={clientContentWideClass}>
        <div className={clientAccountStackClass}>
          <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-950 via-neutral-900 to-orange-950 px-6 py-10 text-white shadow-[0_32px_100px_-40px_rgba(0,0,0,0.55)] sm:px-10 sm:py-12">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-orange-500/25 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-16 left-1/4 h-48 w-48 rounded-full bg-amber-400/10 blur-2xl" aria-hidden />
            <div className="relative">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-orange-300/90">Your account</p>
              <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">Account settings</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">
                Update how we reach you and manage saved delivery addresses and card placeholders. Orders and dish
                ratings live on Orders & ratings.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Saved addresses</p>
                  <p className="mt-1 text-2xl font-black tabular-nums">{addresses.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Payment methods</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-amber-200">{savedCards.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Display name</p>
                  <p className="mt-1 truncate text-lg font-bold text-emerald-200 sm:text-xl">
                    {profileName.trim() || '—'}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {notice ? (
            <p className="rounded-2xl border border-orange-200/60 bg-gradient-to-r from-orange-50 to-amber-50/80 px-5 py-3 text-sm font-medium text-orange-900 shadow-sm ring-1 ring-orange-500/10">
              {notice}
            </p>
          ) : null}

        <Card className={clientElevatedCardClass}>
          <CardHeader className={clientElevatedCardHeaderClass}>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">Identity</p>
            <CardTitle className={cn(clientSectionTitleClass, 'mt-1 text-xl text-neutral-900 sm:text-2xl')}>
              Profile details
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Name and phone show on receipts and delivery.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 px-6 py-6 sm:px-8 sm:py-8">
            <div className="grid gap-2">
              <Label htmlFor="profile-name" className={clientFormLabelClass}>
                Full Name
              </Label>
              <Input
                id="profile-name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className={surfaceInputClass}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-phone" className={clientFormLabelClass}>
                Phone Number
              </Label>
              <Input
                id="profile-phone"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                className={surfaceInputClass}
              />
            </div>
            <Button
              size="default"
              className="w-fit rounded-full px-6"
              onClick={saveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>

        <Card className={clientElevatedCardClass}>
          <CardHeader className={clientElevatedCardHeaderClass}>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">Delivery</p>
            <CardTitle className={cn(clientSectionTitleClass, 'mt-1 text-xl text-neutral-900 sm:text-2xl')}>
              Saved addresses
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Add or edit labels, defaults, and full address lines.</p>
          </CardHeader>
          <CardContent className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
            <InlineFormPanel className={profileInlineFormPanelClass}>
              <Input
                placeholder="Label (Home, Work)"
                value={addressForm.label}
                onChange={(e) => setAddressForm((s) => ({ ...s, label: e.target.value }))}
                className={surfaceInputClass}
              />
              <Input
                placeholder="City"
                value={addressForm.city}
                onChange={(e) => setAddressForm((s) => ({ ...s, city: e.target.value }))}
                className={surfaceInputClass}
              />
              <Input
                placeholder="Address line 1"
                value={addressForm.addressLine1}
                onChange={(e) => setAddressForm((s) => ({ ...s, addressLine1: e.target.value }))}
                className={surfaceInputClass}
              />
              <Input
                placeholder="Address line 2 (optional)"
                value={addressForm.addressLine2}
                onChange={(e) => setAddressForm((s) => ({ ...s, addressLine2: e.target.value }))}
                className={surfaceInputClass}
              />
              <Input
                placeholder="Postal code (optional)"
                value={addressForm.postalCode}
                onChange={(e) => setAddressForm((s) => ({ ...s, postalCode: e.target.value }))}
                className={surfaceInputClass}
              />
              <FormToggleRow
                className={profileCheckboxLabelClass}
                label="Set as default"
                inputProps={{
                  type: 'checkbox',
                  checked: addressForm.isDefault,
                  onChange: (e) =>
                    setAddressForm((s) => ({ ...s, isDefault: (e.target as HTMLInputElement).checked })),
                }}
              />
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="default"
                  className="rounded-full px-5"
                  onClick={saveAddress}
                  disabled={savingAddress}
                >
                  {savingAddress
                    ? 'Saving...'
                    : addressForm.id
                      ? 'Update Address'
                      : 'Add Address'}
                </Button>
                {addressForm.id ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddressForm(emptyAddressForm)}
                  >
                    Cancel Edit
                  </Button>
                ) : null}
              </div>
            </InlineFormPanel>
            {addresses.length === 0 ? (
              <EmptyState
                title="No saved addresses"
                description="Add an address during checkout to save it here."
              />
            ) : (
              <div className="space-y-4">
                {addresses.map((address) => (
                  <div
                    key={address.id ?? `${address.label}-${address.addressLine1}`}
                    className="rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50/50 p-4 shadow-sm ring-1 ring-black/[0.02] transition-shadow hover:shadow-md"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="font-semibold text-neutral-900">
                        {address.label}
                      </p>
                      <div className="flex items-center gap-2">
                        {address.isDefault ? (
                          <span className={profileDefaultBadgeClass}>
                            Default
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await CustomerApiService.saveAddress({ ...address, isDefault: true });
                              await loadData();
                              setNotice('Default address updated.');
                            }}
                          >
                            Set Default
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setAddressForm(toAddressForm(address))
                          }
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[address.addressLine1, address.addressLine2, address.city, address.postalCode]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={clientElevatedCardClass}>
          <CardHeader className={clientElevatedCardHeaderClass}>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">Checkout</p>
            <CardTitle className={cn(clientSectionTitleClass, 'mt-1 text-xl text-neutral-900 sm:text-2xl')}>
              Saved cards
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Secure token placeholders — not full card numbers.</p>
          </CardHeader>
          <CardContent className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
            <InlineFormPanel className={profileInlineFormPanelClass}>
              <Input
                placeholder="Card brand (Visa, MasterCard)"
                value={cardForm.cardBrand}
                onChange={(e) => setCardForm((s) => ({ ...s, cardBrand: e.target.value }))}
                className={surfaceInputClass}
              />
              <Input
                placeholder="Last 4 digits"
                maxLength={4}
                value={cardForm.last4}
                onChange={(e) =>
                  setCardForm((s) => ({ ...s, last4: e.target.value.replace(/\D/g, '') }))
                }
                className={surfaceInputClass}
              />
              <Input
                placeholder="Payment token"
                value={cardForm.token}
                onChange={(e) => setCardForm((s) => ({ ...s, token: e.target.value }))}
                className={cn(surfaceInputClass, 'md:col-span-2')}
              />
              <FormToggleRow
                className={profileCheckboxLabelClass}
                label="Set as default"
                inputProps={{
                  type: 'checkbox',
                  checked: cardForm.isDefault,
                  onChange: (e) =>
                    setCardForm((s) => ({ ...s, isDefault: (e.target as HTMLInputElement).checked })),
                }}
              />
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="default"
                  className="rounded-full px-5"
                  onClick={saveCard}
                  disabled={savingCard}
                >
                  {savingCard ? 'Saving...' : cardForm.id ? 'Update Card' : 'Add Card'}
                </Button>
                {cardForm.id ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCardForm(emptyCardForm)}
                  >
                    Cancel Edit
                  </Button>
                ) : null}
              </div>
            </InlineFormPanel>
            {savedCards.length === 0 ? (
              <EmptyState
                title="No saved cards"
                description="Your saved payment methods will appear here."
              />
            ) : (
              <div className="space-y-4">
                {savedCards.map((card) => (
                  <div
                    key={card.id ?? `${card.cardBrand}-${card.last4}-${card.token}`}
                    className="rounded-2xl border border-neutral-800/50 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 text-white shadow-[0_12px_32px_-16px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold tracking-wide">
                        {card.cardBrand.toUpperCase()} •••• {card.last4}
                      </p>
                      <div className="flex items-center gap-2">
                        {card.isDefault ? (
                          <span className={profileDefaultBadgeClass}>
                            Default
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await CustomerApiService.saveCard({ ...card, isDefault: true });
                              await loadData();
                              setNotice('Default card updated.');
                            }}
                          >
                            Set Default
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setCardForm(toCardForm(card))
                          }
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
