export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  /** Example copy for layout only. Placeholders are never rendered in production builds. */
  placeholder?: boolean;
}

/**
 * Replace with REAL, consented quotes from beta users before launch.
 * Publishing invented reviews is misleading to customers (and illegal in the EU — Directive 2019/2161).
 */
export const TESTIMONIALS: Testimonial[] = [
  { quote: 'I went from one idea to a full week of posts in an afternoon. The approval step means nothing weird goes out.', name: 'Example creator', role: 'Fruit Drama account', placeholder: true },
  { quote: 'Character consistency across scenes is the thing every other tool gets wrong. This one keeps my lemon a lemon.', name: 'Example creator', role: 'Faceless channel', placeholder: true },
  { quote: 'Seeing the credit cost before rendering is exactly what I wanted. No surprise bills.', name: 'Example agency', role: 'Short-form studio', placeholder: true },
];

export const visibleTestimonials = () => TESTIMONIALS.filter((t) => !t.placeholder || import.meta.env.DEV);
