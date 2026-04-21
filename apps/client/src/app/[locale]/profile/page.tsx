'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { CustomerApiService } from '../../../services/api';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  FormToggleRow,
  InlineFormPanel,
  PageHeroHeader,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@wrap-roll/shared-ui';
import type { CustomerAddress, CustomerHistoryOrder, SavedPaymentToken } from '@wrap-roll/contracts';
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
  clientContentWideClass,
  clientFormLabelClass,
  clientGlassPanelFlatClass,
  clientPageShellClass,
  clientSectionTitleClass,
} from '@/lib/client-page-shell';

export default function ProfilePage() {
  const locale = useLocale();
  const router = useRouter();
  const [history, setHistory] = useState<CustomerHistoryOrder[]>([]);
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
      const [profileRes, historyRes, addressBookRes, savedCardsRes] = await Promise.all([
        CustomerApiService.getProfile().catch(() => null),
        CustomerApiService.getHistory().catch(() => []),
        CustomerApiService.getAddressBook().catch(() => []),
        CustomerApiService.getSavedCards().catch(() => []),
      ]);
      const profileData = profileRes ?? null;
      setProfileName(String(profileData?.name ?? ''));
      setProfilePhone(String(profileData?.phone ?? ''));
      setHistory(Array.isArray(historyRes) ? historyRes : []);
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
    return (
      <div className={cn(clientPageShellClass, clientContentWideClass)}>
        <div className="mx-auto w-full max-w-4xl">
        <div className="mb-10 h-10 w-48 animate-pulse rounded-lg bg-neutral-100/80" />
        <div className="mb-8 h-64 animate-pulse rounded-[var(--radius-xl)] bg-neutral-100/80" />
        <div className="h-96 animate-pulse rounded-[var(--radius-xl)] bg-neutral-100/80" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(clientPageShellClass, 'overflow-hidden')}>
      <div className={clientContentWideClass}>
        <PageHeroHeader
          title="Account Settings"
          subtitle="Manage your profile, addresses, cards, and orders in one place."
        />
        <div className="mx-auto w-full max-w-4xl space-y-6">
        {notice ? (
          <p className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800">
            {notice}
          </p>
        ) : null}

        <Card
          className={cn(
            clientGlassPanelFlatClass,
            'gap-0',
          )}
        >
          <CardHeader className="px-6 pt-6">
            <CardTitle className={cn(clientSectionTitleClass, 'text-xl text-neutral-900')}>
              Profile Details
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-6 pb-6">
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
              onClick={saveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>

        <Card
          className={cn(
            clientGlassPanelFlatClass,
            'gap-0',
          )}
        >
          <CardHeader className="px-6 pt-6">
            <CardTitle className={cn(clientSectionTitleClass, 'text-xl text-neutral-900')}>
              Saved Addresses
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
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
              <div className="md:col-span-2 flex gap-2">
                <Button
                  type="button"
                  size="default"
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
                    className="rounded-2xl border border-neutral-200/80 bg-white/70 p-4 shadow-sm"
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

        <Card
          className={cn(
            clientGlassPanelFlatClass,
            'gap-0',
          )}
        >
          <CardHeader className="px-6 pt-6">
            <CardTitle className={cn(clientSectionTitleClass, 'text-xl text-neutral-900')}>
              Saved Cards
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
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
              <div className="md:col-span-2 flex gap-2">
                <Button
                  type="button"
                  size="default"
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
                    className="rounded-2xl border border-neutral-200/80 bg-gradient-to-r from-slate-800 to-slate-700 p-4 text-white shadow-sm"
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

        <Card
          className={cn(
            clientGlassPanelFlatClass,
            'gap-0',
          )}
        >
          <CardHeader className="px-6 pt-6">
            <CardTitle className={cn(clientSectionTitleClass, 'text-xl text-neutral-900')}>
              Order History
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {history.length === 0 ? (
              <EmptyState
                title="No orders yet"
                description="Your completed orders will show up here."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-neutral-200/80 hover:bg-transparent">
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-semibold">
                        #{order.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(order.placedAt).toLocaleDateString()} •{' '}
                        {order.fulfillmentType}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            order.status === 'delivered'
                              ? 'text-sm font-semibold text-success'
                              : 'text-sm font-semibold text-orange-600'
                          }
                        >
                          {order.status.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        LKR {Number(order.total).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/${locale}/order/success?id=${encodeURIComponent(order.id)}`)
                          }
                        >
                          Track
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
