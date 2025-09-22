import { Directive, ElementRef, HostListener, Input, Optional, OnChanges, SimpleChanges } from '@angular/core';
import { NgModel } from '@angular/forms';
import { computed, signal } from '@angular/core';

export type MentionTrigger = '@' | '#';

export interface MentionCategory {
    id: string;
    name: string;
}

export interface MentionOption {
    id?: string;
    label: string;
    value: string;
    type: 'category' | 'tag';
}

interface MentionContext {
    start: number;
    end: number;
    trigger: MentionTrigger;
    query: string;
}

@Directive({
    selector: '[appMentionable]',
    standalone: true,
    exportAs: 'appMentionable'
})
export class MentionableDirective implements OnChanges {

    @Input() mentionCategories: MentionCategory[] = [];
    @Input() mentionTags: string[] = [];

    private optionsSignal = signal<MentionOption[]>([]);
    private activeIndexSignal = signal(0);
    private contextSignal = signal<MentionContext | null>(null);
    private selectionInserted = false;

    options = computed(() => this.optionsSignal());
    activeIndex = computed(() => this.activeIndexSignal());
    context = computed(() => this.contextSignal());
    currentTrigger = computed(() => this.contextSignal()?.trigger ?? null);

    constructor(private host: ElementRef<HTMLInputElement | HTMLTextAreaElement>, @Optional() private ngModel?: NgModel) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['mentionCategories'] || changes['mentionTags']) {
            this.refreshActiveOptions();
        }
    }

    @HostListener('input')
    onInput() {
        const el = this.host.nativeElement;
        const caret = el.selectionStart ?? 0;
        const value = el.value;
        const beforeCaret = value.slice(0, caret);
        const match = beforeCaret.match(/(^|\s)([@#])([\w-]*)$/);

        if (!match) {
            this.clearMention();
            return;
        }

        const trigger = match[2] as MentionTrigger;
        const query = match[3] ?? '';
        const start = caret - query.length - 1;

        const options = this.filterOptions(trigger, query);
        if (options.length === 0) {
            this.clearMention();
            return;
        }

        this.optionsSignal.set(options);
        this.activeIndexSignal.set(0);
        this.contextSignal.set({ start, end: caret, trigger, query });
    }

    @HostListener('keydown', ['$event'])
    onKeydown(event: KeyboardEvent) {
        const ctx = this.contextSignal();
        const options = this.optionsSignal();

        if (!ctx || options.length === 0) {
            return;
        }

        switch (event.key) {
            case 'ArrowDown': {
                event.preventDefault();
                const next = (this.activeIndexSignal() + 1) % options.length;
                this.activeIndexSignal.set(next);
                break;
            }
            case 'ArrowUp': {
                event.preventDefault();
                const prev = (this.activeIndexSignal() - 1 + options.length) % options.length;
                this.activeIndexSignal.set(prev);
                break;
            }
            case 'Enter':
            case 'Tab': {
                event.preventDefault();
                event.stopPropagation();
                const option = options[this.activeIndexSignal()];
                if (option) {
                    this.selectionInserted = true;
                    queueMicrotask(() => {
                        setTimeout(() => {
                            this.selectionInserted = false;
                        }, 100)
                    });
                    this.applyOption(option, ctx);
                }
                break;
            }
            case 'Escape': {
                event.preventDefault();
                this.clearMention();
                break;
            }
            case 'ArrowLeft':
            case 'ArrowRight':
            case 'Home':
            case 'End': {
                this.clearMention();
                break;
            }
            default:
                break;
        }
    }

    @HostListener('blur')
    onBlur() {
        queueMicrotask(() => this.clearMention());
    }

    setActiveIndex(index: number) {
        const options = this.optionsSignal();
        if (options.length === 0) {
            return;
        }
        const normalized = Math.max(0, Math.min(options.length - 1, index));
        this.activeIndexSignal.set(normalized);
    }

    isActive() {
        const ctx = this.contextSignal();
        return !!ctx && this.optionsSignal().length > 0;
    }

    getOptions() {
        return this.optionsSignal();
    }

    selectOption(option: MentionOption, event?: Event) {
        const ctx = this.contextSignal();
        if (!ctx) {
            return;
        }
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        this.selectionInserted = true;
        queueMicrotask(() => {
            this.selectionInserted = false;
        });
        this.applyOption(option, ctx);
    }

    consumeSelection(): boolean {
        const result = this.selectionInserted;
        setTimeout(() => {
            this.selectionInserted = false;
        }, 50);
        return result;
    }

    private applyOption(option: MentionOption, ctx: MentionContext) {
        const el = this.host.nativeElement;
        const value = el.value;
        const before = value.slice(0, ctx.start);
        const after = value.slice(ctx.end);
        const insertion = `${ctx.trigger}${option.value}`;
        const needsSpace = after.length === 0 || !/^\s/.test(after);
        const spacer = needsSpace ? ' ' : '';
        const nextValue = `${before}${insertion}${spacer}${after}`;

        this.updateValue(nextValue);
        const nextCaret = ctx.start + insertion.length + (needsSpace ? 1 : 0);
        queueMicrotask(() => {
            el.focus();
            el.setSelectionRange(nextCaret, nextCaret);
        });
        this.clearMention();
    }

    private updateValue(value: string) {
        const el = this.host.nativeElement;
        el.value = value;
        if (this.ngModel) {
            this.ngModel.control?.setValue(value);
        }
    }

    private filterOptions(trigger: MentionTrigger, query: string): MentionOption[] {
        const normalized = query.toLowerCase();
        if (trigger === '@') {
            return this.mentionCategories
                .filter(cat => cat.name.toLowerCase().includes(normalized))
                .slice(0, 2)
                .map(cat => ({ id: cat.id, label: cat.name, value: cat.name, type: 'category' }));
        }

        const unique = Array.from(new Set(this.mentionTags));
        return unique
            .filter(tag => tag.toLowerCase().includes(normalized))
            .slice(0, 2)
            .map(tag => ({ label: tag, value: tag, type: 'tag' }));
    }

    private clearMention() {
        this.contextSignal.set(null);
        this.optionsSignal.set([]);
        this.activeIndexSignal.set(0);
    }

    private refreshActiveOptions() {
        const ctx = this.contextSignal();
        if (!ctx) {
            return;
        }
        const options = this.filterOptions(ctx.trigger, ctx.query);
        if (options.length === 0) {
            this.clearMention();
            return;
        }
        this.optionsSignal.set(options);
        const current = this.activeIndexSignal();
        if (current >= options.length) {
            this.activeIndexSignal.set(options.length - 1);
        }
    }
}
