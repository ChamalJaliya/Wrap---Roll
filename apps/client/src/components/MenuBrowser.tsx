'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { useClientStore } from '../store/useClientStore';
import { useMenuStore } from '../store/useMenuStore';
import { MenuService, CustomerApiService } from '../services/api';
import {
  MenuItem,
  isMenuItemImageUrl,
  MENU_ITEM_IMAGE_URL_MAX_LEN,
  MENU_ITEM_REVIEW_REPLY_MAX_PHOTOS,
  type MenuItemReviewSummary,
  type PublicMenuItemReviewList,
  type PublicMenuItemReviewRow,
} from '@wrap-roll/contracts';
import { Badge, Button, Card, Dialog, DialogContent, DialogHeader, DialogTitle, Label, Textarea } from '@wrap-roll/shared-ui';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import { cn } from '@/lib/utils';
import { WrapBuilder } from './WrapBuilder';
import { CartSidebar } from './CartSidebar';
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Info,
  Leaf,
  Flame,
  Milk,
  Dumbbell,
  Wheat,
  Coffee,
  ThumbsUp,
  MessageCircle,
  ImagePlus,
  X,
} from 'lucide-react';

function guestInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function formatGuestThreadDate(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function MenuBrowser() {
  const t = useTranslations('Menu');
  const tCart = useTranslations('Cart');
  const tIndexCat = useTranslations('Index.categories');

  const categoryLabel = useCallback(
    (cat: string) => {
      if (cat === 'all') return t('categoryAll');
      if (cat === 'All' || cat === 'Wraps' || cat === 'Drinks' || cat === 'Sides') {
        return tIndexCat(cat as 'All' | 'Wraps' | 'Drinks' | 'Sides');
      }
      return cat;
    },
    [t, tIndexCat],
  );

  const { 
    items, 
    loading, 
    error, 
    fetchMenu, 
    filters, 
    setFilters, 
    page, 
    lastPage 
  } = useMenuStore();
  
  const { addToCart, cart, getTotalPrice } = useClientStore();

  const [selectedItemForBuilder, setSelectedItemForBuilder] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(filters.search);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(['all']);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [selectedInfo, setSelectedInfo] = useState<{
    itemId: string;
    name: string;
    categoryName: string;
    prepTimeMinutes: number;
    categoryAveragePrepTimeMinutes: number;
    ingredientHighlights: string[];
    healthTips: string[];
    nutritionTags: Array<{ key: string; label: string }>;
  } | null>(null);
  const [reviewBlock, setReviewBlock] = useState<{
    summary: MenuItemReviewSummary;
    list: PublicMenuItemReviewList;
  } | null>(null);
  const [reviewSession, setReviewSession] = useState(false);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replyPhotoDrafts, setReplyPhotoDrafts] = useState<Record<string, string[]>>({});
  const [replyPhotoErrors, setReplyPhotoErrors] = useState<Record<string, string | undefined>>({});
  const [reviewActionKey, setReviewActionKey] = useState<string | null>(null);
  const [replySigningLabel, setReplySigningLabel] = useState('');
  const categoryRailRef = useRef<HTMLDivElement | null>(null);

  const tagIcon = (key: string) => {
    switch (key) {
      case 'protein':
        return Dumbbell;
      case 'fresh':
        return Leaf;
      case 'spicy':
        return Flame;
      case 'dairy':
        return Milk;
      case 'fiber':
        return Wheat;
      case 'caffeine':
        return Coffee;
      default:
        return Info;
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  useEffect(() => {
    MenuService.getMenuCategories()
      .then((cats) => {
        const names = cats.map((c) => c.name).filter(Boolean);
        setCategoryOptions(['all', ...names]);
      })
      .catch(() => {
        setCategoryOptions(['all', 'Wraps', 'Drinks', 'Sides']);
      });
  }, []);

  useEffect(() => {
    if (!infoOpen) return;
    getBrowserSupabase()
      ?.auth.getSession()
      .then(({ data }) => setReviewSession(!!data.session))
      .catch(() => setReviewSession(false));
  }, [infoOpen]);

  useEffect(() => {
    if (!infoOpen || !reviewSession) {
      setReplySigningLabel('');
      return;
    }
    let cancelled = false;
    CustomerApiService.getProfile()
      .then((p) => {
        if (cancelled) return;
        const name = (p?.name ?? '').trim();
        const email = (p?.email ?? '').trim();
        setReplySigningLabel(name || email.split('@')[0] || 'You');
      })
      .catch(() => {
        if (!cancelled) setReplySigningLabel('You');
      });
    return () => {
      cancelled = true;
    };
  }, [infoOpen, reviewSession]);

  const refreshPublicReviews = useCallback(async () => {
    const id = selectedInfo?.itemId;
    if (!id) return;
    try {
      const [summary, list] = await Promise.all([
        MenuService.getMenuItemReviewSummary(id).catch(() => null),
        MenuService.getMenuItemPublicReviews(id, { page: 1, limit: 12 }).catch(() => null),
      ]);
      if (summary && list) setReviewBlock({ summary, list });
    } catch {
      /* ignore */
    }
  }, [selectedInfo?.itemId]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== filters.search) {
        setFilters({ search: searchTerm, page: 1 });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, filters.search, setFilters]);

  const handleItemAction = (item: MenuItem) => {
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      setSelectedItemForBuilder(item);
    } else {
      addToCart(item);
    }
  };

  const openInfoCard = async (itemId: string) => {
    setInfoOpen(true);
    setInfoLoading(true);
    setReviewBlock(null);
    try {
      const [info, summary, list] = await Promise.all([
        MenuService.getMenuItemInfo(itemId),
        MenuService.getMenuItemReviewSummary(itemId).catch(() => null),
        MenuService.getMenuItemPublicReviews(itemId, { page: 1, limit: 8 }).catch(() => null),
      ]);
      setSelectedInfo(info);
      if (summary && list) setReviewBlock({ summary, list });
    } finally {
      setInfoLoading(false);
    }
  };

  const scrollCategories = (direction: 'left' | 'right') => {
    const rail = categoryRailRef.current;
    if (!rail) return;
    const amount = Math.max(180, Math.floor(rail.clientWidth * 0.5));
    rail.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="w-full">
      {/* Sticky filter/search rail for large category sets */}
      <div className="sticky top-[80px] z-[50] w-full px-4 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 rounded-[2rem] border border-white/20 bg-white/70 p-3 shadow-2xl backdrop-blur-2xl transition-all hover:bg-white/85">
          <div className="flex items-center gap-4">
            <div className="flex flex-1 items-center gap-3 px-4">
            <Search className="h-5 w-5 text-neutral-400" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border-none bg-transparent py-3 text-lg font-medium outline-none placeholder:text-neutral-300"
            />
          </div>

            <select
              value={filters.sort}
              onChange={(e) => setFilters({ sort: e.target.value as any, page: 1 })}
              className="bg-transparent font-bold text-xs uppercase tracking-widest outline-none cursor-pointer pr-4 max-md:hidden"
            >
              <option value="newest">{t('sortNewest')}</option>
              <option value="price">{t('sortPrice')}</option>
            </select>

            <Button variant="ghost" size="icon" className="md:hidden rounded-full h-12 w-12">
              <SlidersHorizontal className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden h-9 w-9 rounded-full md:inline-flex"
              onClick={() => scrollCategories('left')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div
              ref={categoryRailRef}
              className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1"
            >
              {categoryOptions.map((cat) => (
                <Button
                  key={cat}
                  variant={filters.category === cat ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilters({ category: cat, page: 1 })}
                  className={cn(
                    'shrink-0 rounded-full px-5 font-bold text-[11px] uppercase tracking-widest transition-all',
                    filters.category === cat && 'bg-primary text-white shadow-lg shadow-primary/30'
                  )}
                >
                  {categoryLabel(cat)}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden h-9 w-9 rounded-full md:inline-flex"
              onClick={() => scrollCategories('right')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ sort: e.target.value as any, page: 1 })}
              className="ml-1 h-9 rounded-full border border-neutral-200 bg-white/70 px-3 text-[10px] font-bold uppercase tracking-widest outline-none md:hidden"
            >
              <option value="newest">{t('sortNewest')}</option>
              <option value="price">{t('sortPriceShort')}</option>
            </select>
          </div>
        </div>
      </div>

      <div id="menu-anchor" className="scroll-mt-[160px]" />

      <main className="mx-auto max-w-[1400px] px-6 py-12">
        {loading ? (
          <section className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-10">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col gap-6">
                <div className="aspect-[4/3] w-full animate-pulse rounded-[2.5rem] bg-neutral-100/80" />
                <div className="space-y-3 px-4">
                  <div className="h-8 w-2/3 animate-pulse rounded-xl bg-neutral-100/80" />
                  <div className="h-4 w-full animate-pulse rounded-lg bg-neutral-100/40" />
                </div>
              </div>
            ))}
          </section>
        ) : error ? (
          <div className="mx-auto max-w-lg rounded-3xl border border-destructive/20 bg-destructive/5 px-8 py-10 text-center">
            <p className="font-display text-xl font-black text-neutral-900">{t('couldNotLoad')}</p>
            <p className="mt-3 text-sm text-muted-foreground">{error}</p>
            <p className="mt-4 text-xs text-muted-foreground">
              {t('apiHint', {
                npmApi: t('npmApi'),
                port: t('defaultApiPort'),
                apiProxy: t('apiProxy'),
                envFile: t('envFile'),
              })}
            </p>
            <Button variant="default" className="mt-6 rounded-full" onClick={() => fetchMenu()}>
              {t('retry')}
            </Button>
          </div>
        ) : (
          <>
            <AnimatePresence mode="popLayout">
              {items.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -40 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <div className="relative mb-10 h-[400px] w-full max-w-[500px] overflow-hidden rounded-[3rem] shadow-2xl">
                    <img 
                      src="/images/empty-menu.png" 
                      alt={t('emptyImageAlt')} 
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-10 left-10 right-10 flex flex-col items-center">
                      <p className="text-2xl font-display font-black text-white mb-2">{t('noWraps')}</p>
                      <p className="text-white/60 font-medium">{t('adjustFilters')}</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={() => {
                      setSearchTerm('');
                      setFilters({ search: '', category: 'all', page: 1 });
                    }}
                    className="rounded-full px-10 border-2"
                  >
                    {t('clearFilters')}
                  </Button>
                </motion.div>
              ) : (
                <motion.section 
                  layout
                  className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-10"
                >
                  {items.map((item, idx) => (
                    <motion.div
                      layout
                      key={item.itemId}
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      transition={{ duration: 0.4, delay: idx * 0.05 }}
                    >
                      <Card className="group relative flex h-full flex-col overflow-hidden rounded-[2.5rem] border-none bg-white p-0 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] transition-all duration-500 hover:-translate-y-3 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)]">
                        {item.imageUrl && (
                          <div className="relative aspect-[4/3] w-full overflow-hidden">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                            <div className="absolute top-6 right-6">
                              <Badge className="bg-white/90 backdrop-blur-md text-neutral-900 border-none font-black text-[10px] uppercase">
                                {item.categoryName}
                              </Badge>
                            </div>
                          </div>
                        )}
                        <div className="flex flex-grow flex-col p-8">
                          <h3 className="mb-2 font-display text-2xl font-black text-neutral-900 line-clamp-1">
                            {item.name}
                          </h3>
                          {(item.reviewCount ?? 0) > 0 && item.averageRating != null ? (
                            <p className="mb-2 text-xs font-bold text-amber-700">
                              ★ {item.averageRating.toFixed(1)} · {item.reviewCount} review
                              {item.reviewCount === 1 ? '' : 's'}
                            </p>
                          ) : null}
                          <p className="mb-6 line-clamp-2 h-[2.8em] text-[0.9rem] font-medium leading-relaxed text-neutral-400">
                            {item.description}
                          </p>
                          
                          <div className="mb-4 flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/70 px-3 py-2">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{t('avgPrep')}</p>
                              <p className="text-sm font-semibold text-neutral-700">{t('prepMinutes', { minutes: item.prepTimeMinutes })}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 rounded-full px-3 text-xs font-bold"
                              onClick={() => openInfoCard(item.itemId)}
                            >
                              <Info className="mr-1 h-4 w-4" /> {t('productInfo')}
                            </Button>
                          </div>

                          <div className="mt-auto flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-300">{t('price')}</span>
                              <span className="font-display text-2xl font-black text-primary">
                                {tCart('currency')} {item.basePrice.toLocaleString()}
                              </span>
                            </div>
                            <Button
                              onClick={() => handleItemAction(item)}
                              size="lg"
                              className={cn(
                                "h-14 w-14 rounded-full p-0 shadow-xl transition-all hover:scale-110",
                                item.modifierGroups?.length > 0 ? "bg-white border-2 border-neutral-100 text-neutral-900" : "bg-primary text-white shadow-primary/40"
                              )}
                            >
                              {item.modifierGroups?.length > 0 ? (
                                <SlidersHorizontal className="h-5 w-5" />
                              ) : (
                                <span className="text-xl">+</span>
                              )}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </motion.section>
              )}
            </AnimatePresence>

            {/* PAGINATION */}
            {lastPage > 1 && (
              <div className="mt-20 flex items-center justify-center gap-4">
                <Button
                  variant="ghost"
                  disabled={page === 1}
                  onClick={() => setFilters({ page: page - 1 })}
                  className="rounded-full h-12 w-12 p-0"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                
                <div className="flex items-center gap-2">
                  {Array.from({ length: lastPage }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      variant={page === p ? 'default' : 'ghost'}
                      onClick={() => setFilters({ page: p })}
                      className={cn(
                        "h-12 w-12 rounded-full font-black text-sm transition-all",
                        page === p && "scale-110 shadow-lg shadow-primary/20"
                      )}
                    >
                      {p}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  disabled={page === lastPage}
                  onClick={() => setFilters({ page: page + 1 })}
                  className="rounded-full h-12 w-12 p-0"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {selectedItemForBuilder && (
        <WrapBuilder
          item={selectedItemForBuilder}
          onClose={() => setSelectedItemForBuilder(null)}
          onConfirm={(mods: any) => {
            addToCart(selectedItemForBuilder, mods);
            setSelectedItemForBuilder(null);
          }}
        />
      )}

      <Dialog
        open={infoOpen}
        onOpenChange={(open) => {
          setInfoOpen(open);
          if (!open) {
            setReviewBlock(null);
            setSelectedInfo(null);
            setReplyDraft({});
            setReplyPhotoDrafts({});
            setReplyPhotoErrors({});
          }
        }}
      >
        <DialogContent
          showCloseButton
          className="flex max-h-[min(92dvh,900px)] flex-col gap-0 overflow-hidden border-0 bg-white p-0 shadow-[0_32px_120px_-40px_rgba(15,23,42,0.45)] sm:max-w-2xl sm:rounded-[28px]"
        >
          <DialogHeader className="shrink-0 border-b border-neutral-100 bg-gradient-to-r from-primary/[0.08] via-white to-primary/[0.04] px-6 py-5 pr-12 text-left sm:px-8 sm:pr-14">
            <DialogTitle className="font-display text-2xl font-black tracking-tight text-neutral-900">
              {t('productInfoCard')}
            </DialogTitle>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              {t('productInfoSubtitle')}
            </p>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          {infoLoading ? (
            <div className="px-8 py-10">
              <p className="text-sm text-muted-foreground">{t('loadingInfo')}</p>
            </div>
          ) : !selectedInfo ? (
            <div className="px-8 py-10">
              <p className="text-sm text-muted-foreground">{t('loadInfoFailed')}</p>
            </div>
          ) : (
            <div className="space-y-5 bg-neutral-50/40 px-6 py-6 sm:px-8 sm:py-7">
              <div className="rounded-2xl border border-primary/15 bg-white p-5 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge className="border-none bg-primary/10 text-primary">{selectedInfo.categoryName}</Badge>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{t('freshlyMade')}</span>
                </div>
                <p className="font-display text-2xl font-black text-neutral-900">{selectedInfo.name}</p>
                <p className="mt-2 text-sm text-neutral-600">
                  {t('prepLine', {
                    prep: selectedInfo.prepTimeMinutes,
                    avg: selectedInfo.categoryAveragePrepTimeMinutes,
                  })}
                </p>
              </div>
              <div>
                {selectedInfo.nutritionTags.length ? (
                  <>
                    <p className="mb-2 text-sm font-semibold text-neutral-800">{t('nutritionTags')}</p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {selectedInfo.nutritionTags.map((tag) => {
                        const Icon = tagIcon(tag.key);
                        return (
                          <Badge key={`${tag.key}-${tag.label}`} variant="secondary" className="gap-1 rounded-full border bg-white px-3 py-1 text-[11px] font-semibold text-neutral-700">
                            <Icon className="h-3.5 w-3.5" />
                            {tag.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </>
                ) : null}
                <p className="mb-2 text-sm font-semibold text-neutral-800">{t('ingredientHighlights')}</p>
                <div className="flex flex-wrap gap-2">
                  {selectedInfo.ingredientHighlights.length ? (
                    selectedInfo.ingredientHighlights.map((ing) => (
                      <Badge key={ing} variant="secondary" className="rounded-full border bg-white px-3 py-1 text-[11px] font-semibold text-neutral-700">
                        {ing}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('noHighlights')}</p>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="mb-2 text-sm font-semibold text-neutral-800">{t('healthyTips')}</p>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-neutral-600">
                  {selectedInfo.healthTips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
              {reviewBlock ? (
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <p className="mb-1 text-sm font-semibold text-neutral-800">Guest ratings</p>
                  <p className="text-xs text-muted-foreground">
                    {reviewBlock.summary.reviewCount > 0
                      ? `Average ${reviewBlock.summary.averageRating?.toFixed(1) ?? '—'} from ${reviewBlock.summary.reviewCount} verified reviews`
                      : 'No public reviews yet'}
                  </p>
                  {(reviewBlock.list.items ?? []).length > 0 ? (
                    <ul className="mt-4 space-y-4 border-t border-neutral-100 pt-4">
                      {(reviewBlock.list.items ?? []).map((r: PublicMenuItemReviewRow) => {
                        const photoUrls = r.photoUrls ?? [];
                        const replies = r.replies ?? [];
                        const replyCount = r.replyCount ?? 0;
                        const helpfulCount = r.helpfulCount ?? 0;
                        return (
                        <li key={r.id} className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3 text-sm text-neutral-800">
                          <div className="flex gap-3">
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-[11px] font-black text-white shadow-sm"
                              aria-hidden
                            >
                              {guestInitials((r.authorLabel ?? '').trim() || 'Guest')}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-neutral-900">
                                    {(r.authorLabel ?? '').trim() || 'Guest'}
                                    <span className="ml-1.5 font-normal text-[11px] text-muted-foreground">
                                      · Verified purchase
                                    </span>
                                  </p>
                                  <time
                                    className="mt-0.5 block text-[11px] text-muted-foreground"
                                    dateTime={r.createdAt}
                                  >
                                    {formatGuestThreadDate(r.createdAt)}
                                  </time>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-amber-700">{r.rating}★</span>
                                    <span className="text-xs text-muted-foreground">
                                      {replyCount} {replyCount === 1 ? 'reply' : 'replies'} · {helpfulCount}{' '}
                                      found helpful
                                    </span>
                                  </div>
                                </div>
                                {reviewSession ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 shrink-0 gap-1 text-xs"
                                    disabled={reviewActionKey === r.id}
                                    onClick={() => {
                                      void (async () => {
                                        setReviewActionKey(r.id);
                                        try {
                                          await CustomerApiService.toggleMenuItemReviewHelpful(r.id);
                                          await refreshPublicReviews();
                                        } finally {
                                          setReviewActionKey(null);
                                        }
                                      })();
                                    }}
                                  >
                                    <ThumbsUp className="h-3.5 w-3.5" />
                                    Helpful
                                  </Button>
                                ) : null}
                              </div>
                              {photoUrls.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {photoUrls.map((url) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      key={url.slice(0, 80)}
                                      src={url}
                                      alt=""
                                      className="h-16 w-16 rounded-lg border border-neutral-200 object-cover"
                                    />
                                  ))}
                                </div>
                              ) : null}
                              {r.comment ? (
                                <p className="mt-2 text-neutral-700">{r.comment}</p>
                              ) : (
                                <p className="mt-2 text-xs italic text-muted-foreground">No written comment</p>
                              )}
                            </div>
                          </div>
                          {replies.length > 0 ? (
                            <ul className="mt-3 space-y-3 border-l-2 border-orange-200 pl-3">
                              {replies.map((rep) => {
                                const repPhotos = rep.photoUrls ?? [];
                                return (
                                  <li key={rep.id} className="text-xs text-neutral-700">
                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                      <span className="font-semibold text-neutral-900">{rep.authorLabel}</span>
                                      {rep.authorKind === 'staff' ? (
                                        <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-800">
                                          Team
                                        </span>
                                      ) : null}
                                      <time
                                        className="text-[10px] text-muted-foreground"
                                        dateTime={rep.createdAt}
                                      >
                                        {formatGuestThreadDate(rep.createdAt)}
                                      </time>
                                    </div>
                                    {rep.body ? (
                                      <span className="mt-1 block text-neutral-600">{rep.body}</span>
                                    ) : null}
                                    {repPhotos.length > 0 ? (
                                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        {repPhotos.map((url) => (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            key={url.slice(0, 80)}
                                            src={url}
                                            alt=""
                                            className="h-12 w-12 rounded-md border border-neutral-200 object-cover"
                                          />
                                        ))}
                                      </div>
                                    ) : null}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                          {reviewSession ? (
                            <div className="mt-3 rounded-lg border border-dashed border-neutral-200 bg-white p-2">
                              <Label className="text-[10px] uppercase text-muted-foreground">Your reply</Label>
                              {replySigningLabel ? (
                                <p className="mt-1 text-[11px] text-neutral-600">
                                  Posting as{' '}
                                  <span className="font-semibold text-neutral-900">{replySigningLabel}</span>
                                </p>
                              ) : null}
                              <Textarea
                                className="mt-1 min-h-[56px] text-xs"
                                placeholder="Add a public reply…"
                                value={replyDraft[r.id] ?? ''}
                                onChange={(e) =>
                                  setReplyDraft((prev) => ({ ...prev, [r.id]: e.target.value }))
                                }
                                maxLength={2000}
                              />
                              <Label className="mt-2 text-[10px] uppercase text-muted-foreground">
                                Photos (optional)
                              </Label>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                {(replyPhotoDrafts[r.id] ?? []).map((url, idx) => (
                                  <div
                                    key={`${r.id}-${idx}-${url.slice(0, 24)}`}
                                    className="relative h-12 w-12 shrink-0"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={url}
                                      alt=""
                                      className="h-full w-full rounded-md border border-neutral-200 object-cover"
                                    />
                                    <button
                                      type="button"
                                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white shadow"
                                      aria-label="Remove photo"
                                      onClick={() =>
                                        setReplyPhotoDrafts((prev) => ({
                                          ...prev,
                                          [r.id]: (prev[r.id] ?? []).filter((_, i) => i !== idx),
                                        }))
                                      }
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                                {(replyPhotoDrafts[r.id] ?? []).length < MENU_ITEM_REVIEW_REPLY_MAX_PHOTOS ? (
                                  <>
                                    <input
                                      id={`reply-photos-${r.id}`}
                                      type="file"
                                      accept="image/png,image/jpeg,image/webp,image/gif"
                                      className="sr-only"
                                      onChange={(e) => {
                                        setReplyPhotoErrors((prev) => ({ ...prev, [r.id]: undefined }));
                                        const file = e.target.files?.[0];
                                        e.target.value = '';
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = () => {
                                          const dataUrl = typeof reader.result === 'string' ? reader.result : '';
                                          if (!dataUrl || dataUrl.length > MENU_ITEM_IMAGE_URL_MAX_LEN) {
                                            setReplyPhotoErrors((prev) => ({
                                              ...prev,
                                              [r.id]: 'That image is too large. Try a smaller photo.',
                                            }));
                                            return;
                                          }
                                          if (!isMenuItemImageUrl(dataUrl)) {
                                            setReplyPhotoErrors((prev) => ({
                                              ...prev,
                                              [r.id]: 'Unsupported image format.',
                                            }));
                                            return;
                                          }
                                          setReplyPhotoDrafts((prev) => {
                                            const cur = prev[r.id] ?? [];
                                            if (cur.length >= MENU_ITEM_REVIEW_REPLY_MAX_PHOTOS) return prev;
                                            return { ...prev, [r.id]: [...cur, dataUrl] };
                                          });
                                        };
                                        reader.readAsDataURL(file);
                                      }}
                                    />
                                    <label
                                      htmlFor={`reply-photos-${r.id}`}
                                      className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 text-neutral-500 transition-colors hover:border-orange-300 hover:text-orange-600"
                                    >
                                      <ImagePlus className="h-5 w-5" />
                                    </label>
                                  </>
                                ) : null}
                              </div>
                              {replyPhotoErrors[r.id] ? (
                                <p className="mt-1 text-[11px] text-destructive">{replyPhotoErrors[r.id]}</p>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="mt-2 h-7 text-xs"
                                disabled={reviewActionKey === `${r.id}:reply`}
                                onClick={() => {
                                  const body = (replyDraft[r.id] ?? '').trim();
                                  const photos = replyPhotoDrafts[r.id] ?? [];
                                  if (!body && photos.length === 0) return;
                                  void (async () => {
                                    setReviewActionKey(`${r.id}:reply`);
                                    try {
                                      await CustomerApiService.addMenuItemReviewReply(r.id, {
                                        body,
                                        ...(photos.length ? { photoUrls: photos } : {}),
                                      });
                                      setReplyDraft((prev) => ({ ...prev, [r.id]: '' }));
                                      setReplyPhotoDrafts((prev) => ({ ...prev, [r.id]: [] }));
                                      setReplyPhotoErrors((prev) => ({ ...prev, [r.id]: undefined }));
                                      await refreshPublicReviews();
                                    } finally {
                                      setReviewActionKey(null);
                                    }
                                  })();
                                }}
                              >
                                <MessageCircle className="mr-1 h-3.5 w-3.5" />
                                Post reply
                              </Button>
                            </div>
                          ) : (
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              Sign in to react or join the thread on public reviews.
                            </p>
                          )}
                        </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      <CartSidebar open={isCartOpen} onOpenChange={setIsCartOpen} />

      {cart.length > 0 && !isCartOpen && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-12 right-12 z-[100] flex cursor-pointer items-center gap-8 rounded-[2.5rem] border border-white/20 bg-neutral-900/90 p-4 pl-8 text-white shadow-[0_40px_80px_-20px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02] max-md:inset-x-6 max-md:bottom-6 max-md:right-auto max-md:justify-between"
          onClick={() => setIsCartOpen(true)}
        >
          <div className="flex items-center gap-4">
            <div className="text-3xl drop-shadow-[0_0_10px_hsl(var(--primary))] animate-bounce">
              🌯
            </div>
            <div>
              <div className="font-display text-xl font-black leading-none mb-1">
                {tCart('itemsLabel', {
                  count: cart.reduce((acc: number, i: any) => acc + i.quantity, 0),
                })}
              </div>
              <div className="text-[10px] font-black text-white/50 uppercase tracking-widest leading-none">
                {tCart('currency')} {getTotalPrice().toLocaleString()}
              </div>
            </div>
          </div>
          <Button
            variant="default"
            size="lg"
            className="rounded-[1.5rem] bg-primary px-10 py-4 font-black uppercase tracking-widest shadow-lg shadow-primary/40 hover:scale-105 active:scale-95 transition-all"
          >
            {tCart('reviewBasket')}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
