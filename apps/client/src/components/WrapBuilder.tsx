'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { type MenuItem, type ModifierGroup } from '@wrap-roll/contracts';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@wrap-roll/shared-ui';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface WrapBuilderProps {
  item: MenuItem;
  onClose: () => void;
  onConfirm: (selectedModifiers: any[]) => void;
}

export const WrapBuilder: React.FC<WrapBuilderProps> = ({
  item,
  onClose,
  onConfirm,
}) => {
  const t = useTranslations('Builder');
  const tCart = useTranslations('Cart');
  const currency = tCart('currency');

  // Audit 1: Handle potential naming drift in JSON field from Supabase
  const groups = useMemo(() => {
    return item.modifierGroups || (item as any).modifierGroupsJson || [];
  }, [item]);

  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [totalPrice, setTotalPrice] = useState<number>(item.basePrice);

  // Initialize selections with defaults
  useEffect(() => {
    const initialSelections: Record<string, string[]> = {};
    groups.forEach((group: ModifierGroup) => {
      const defaults = group.options
        .filter((opt) => opt.isDefault)
        .map((opt) => opt.optionId);
      initialSelections[group.groupId] = defaults;
    });
    setSelections(initialSelections);
  }, [groups]);

  // Restore 2: Dynamic Pricing update in real-time
  useEffect(() => {
    let price = item.basePrice;
    Object.keys(selections).forEach((groupId) => {
      const group = groups.find((g: ModifierGroup) => g.groupId === groupId);
      if (group) {
        selections[groupId].forEach((optId) => {
          const option = group.options.find((o) => o.optionId === optId);
          if (option) price += option.priceAdjust;
        });
      }
    });
    setTotalPrice(price);
  }, [selections, groups, item.basePrice]);

  const currentGroup = groups[currentStep] as ModifierGroup | undefined;

  const toggleOption = (group: ModifierGroup, optionId: string) => {
    const currentGroupSelections = selections[group.groupId] || [];
    const isSelected = currentGroupSelections.includes(optionId);

    if (group.type === 'single') {
      if (isSelected && group.required) return;
      setSelections({
        ...selections,
        [group.groupId]: isSelected ? [] : [optionId],
      });
    } else {
      if (isSelected) {
        setSelections({
          ...selections,
          [group.groupId]: currentGroupSelections.filter((id) => id !== optionId),
        });
      } else if (
        currentGroupSelections.length < (group.maxSelect || Infinity)
      ) {
        setSelections({
          ...selections,
          [group.groupId]: [...currentGroupSelections, optionId],
        });
      }
    }
  };

  const isStepValid = useMemo(() => {
    if (!currentGroup) return true;
    const selectedCount = selections[currentGroup.groupId]?.length || 0;
    if (currentGroup.required && selectedCount < (currentGroup.minSelect || 1)) {
      return false;
    }
    return true;
  }, [currentGroup, selections]);

  const handleNext = () => {
    if (currentStep < groups.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleConfirm();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConfirm = () => {
    // Final Audit of all required groups
    const missingRequired = groups.some(
      (group: ModifierGroup) =>
        group.required &&
        (!selections[group.groupId] ||
          selections[group.groupId].length < (group.minSelect || 1))
    );

    if (missingRequired) {
      alert(t('completeRequired'));
      return;
    }

    const formatted = groups
      .filter((group: ModifierGroup) => selections[group.groupId]?.length > 0)
      .map((group: ModifierGroup) => ({
        groupId: group.groupId,
        name: group.name,
        options: group.options
          .filter((opt) => selections[group.groupId].includes(opt.optionId))
          .map((opt) => ({
            optionId: opt.optionId,
            label: opt.label,
            priceAdjust: opt.priceAdjust,
          })),
      }));

    onConfirm(formatted);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton
        className="flex !h-[92dvh] !w-[calc(100%-0.75rem)] !max-w-none flex-col gap-0 overflow-hidden border-0 bg-white p-0 shadow-[0_32px_120px_-40px_rgba(15,23,42,0.4)] sm:!h-[820px] sm:!max-h-[85dvh] sm:!w-[calc(100%-4rem)] sm:!max-w-[1150px] sm:rounded-[32px]"
      >
        <DialogHeader className="border-b border-neutral-100 bg-white px-6 py-5 text-left sm:px-8 sm:py-6">
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <DialogTitle className="pr-8 font-display text-xl font-black tracking-tight text-neutral-900 sm:text-2xl">
                  {t('title', { name: item.name })}
                </DialogTitle>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                  {t('stepOf', {
                    current: Math.min(currentStep + 1, groups.length),
                    total: groups.length,
                  })}
                </p>
              </div>
            </div>

            {/* In-Header Horizontal Summary */}
            <div className="flex flex-wrap items-center gap-2 overflow-x-auto py-1">
              <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">{t('selection')}</span>
              {groups.map((group: ModifierGroup) => {
                const selected = group.options.filter(o => selections[group.groupId]?.includes(o.optionId));
                if (selected.length === 0) return null;
                return selected.map((o) => (
                  <div 
                    key={o.optionId} 
                    className="flex flex-shrink-0 animate-in fade-in zoom-in items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/[0.03] px-2.5 py-1 duration-300"
                  >
                    <span className="text-[10px] font-bold text-neutral-500">{group.name}:</span>
                    <span className="text-[10px] font-black text-primary">{o.label}</span>
                  </div>
                ));
              })}
              {Object.values(selections).every((s) => s.length === 0) && (
                <span className="text-[10px] font-bold italic text-neutral-300">{t('nothingSelected')}</span>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 overflow-hidden bg-neutral-50/30">
          <div className="flex-1 overflow-y-auto relative min-h-[400px] scroll-smooth">
            <AnimatePresence mode="wait">
              {currentGroup && (
                <motion.div
                  key={currentGroup.groupId}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="flex flex-col p-6 sm:p-8 w-full max-w-4xl mx-auto"
                >
                  <div className="mb-6 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
                        {currentGroup.name}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-neutral-500">
                        {currentGroup.type === 'single'
                          ? t('selectOne')
                          : currentGroup.maxSelect
                            ? t('selectUpTo', { max: currentGroup.maxSelect })
                            : t('selectUpToAny')}
                      </p>
                    </div>
                    <Badge
                      variant={currentGroup.required ? 'default' : 'secondary'}
                      className="shrink-0 rounded-full px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em]"
                    >
                      {currentGroup.required ? t('required') : t('optional')}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-3 pb-8 md:grid-cols-2 md:gap-4 lg:grid-cols-2">
                    {currentGroup.options.map((option) => {
                      const isSelected = selections[currentGroup.groupId]?.includes(
                        option.optionId
                      );
                      return (
                        <button
                          type="button"
                          key={option.optionId}
                          className={cn(
                            'group relative flex min-h-[72px] w-full items-center justify-between overflow-hidden rounded-2xl border bg-white px-6 py-4 text-left transition-all duration-300',
                            isSelected
                              ? 'border-primary bg-primary/[0.03] ring-1 ring-primary/40 shadow-[0_8px_20px_-6px_rgba(var(--primary-rgb),0.15)]'
                              : 'border-neutral-200 hover:border-primary/40 hover:bg-neutral-50/80 shadow-sm shadow-black/[0.02]'
                          )}
                          onClick={() => toggleOption(currentGroup, option.optionId)}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={cn(
                                'flex size-6 shrink-0 items-center justify-center border-2 transition-all duration-300',
                                currentGroup.type === 'single' ? 'rounded-full' : 'rounded-lg',
                                isSelected
                                  ? 'border-primary bg-primary text-white scale-110'
                                  : 'border-neutral-300 bg-white group-hover:border-primary/50'
                              )}
                            >
                              {isSelected && <Check className="size-4 stroke-[4] animate-in zoom-in-50 duration-200" />}
                            </div>
                            <p className={cn(
                              "text-base font-bold transition-colors",
                              isSelected ? "text-primary" : "text-neutral-800"
                            )}>
                              {option.label}
                            </p>
                          </div>
                          
                          <div className={cn(
                            "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black transition-all",
                            isSelected ? "bg-primary text-white" : "bg-neutral-100 text-neutral-500"
                          )}>
                            {option.priceAdjust > 0
                              ? t('pricePlus', {
                                  currency,
                                  amount: option.priceAdjust.toLocaleString(),
                                })
                              : t('included')}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <footer className="z-10 flex flex-col gap-3 border-t border-neutral-200 bg-white/95 p-5 shadow-[0_-10px_35px_rgba(15,23,42,0.05)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:gap-0">
          <div className="flex flex-col">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
              {t('totalEstimate')}
            </p>
            <p className="font-display text-2xl font-black text-neutral-900">
              <span className="mr-1 text-sm font-bold text-primary">{currency}</span>
              {totalPrice.toLocaleString()}
            </p>
          </div>
          
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-3">
            {currentStep > 0 && (
              <Button 
                variant="outline" 
                size="lg" 
                onClick={handleBack}
                className="h-11 w-11 rounded-xl border-neutral-300 p-0"
              >
                <ChevronLeft className="size-5" />
              </Button>
            )}
            
            <Button 
              size="lg" 
              onClick={handleNext}
              disabled={!isStepValid}
              className={cn(
                "h-11 min-w-[150px] rounded-xl px-6 text-xs font-semibold uppercase tracking-[0.14em] transition-all sm:min-w-[170px] sm:px-7",
                isStepValid ? "shadow-lg shadow-primary/20" : "opacity-50"
              )}
            >
              {currentStep === groups.length - 1 ? t('finish') : t('next')}
              {currentStep < groups.length - 1 && <ChevronRight className="ml-2 size-4.5" />}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
};

