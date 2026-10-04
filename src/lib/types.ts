export interface QuoteLine {
  id: string;
  quantity: number;
  isQuoting: boolean;
  isFat: boolean | null;
  unitCost: number | null;
  variance: string;
  price: number | null;
  currency: string;
  leadTime: number | null;
  additionalNotes: string;
}
export interface Product {
  id: string;
  partNumber: string;
  nsn: string;
  description: string;
  packagingIncluded: boolean | null;
  certifications: string;
  nreCost: number | null;
  coo: string;
  hazmatItem: boolean | null;
  mfrCage: string;
  mfrPartNumber: string;
  shippingIncluded: boolean | null;
  additionalNotes: string;
  lines: QuoteLine[];
}
export interface Attachment {
  id: string;
  filename: string;
  pages: string[];
}
export interface Email {
  id: string;
  from: string;
  fromName: string;
  to: string;
  date: string;
  subject: string;
  body: string;
  attachments: Attachment[];
}
export interface Vendor {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  cage: string;
  paymentTerms: string;
  daysQuoteValid: number | null;
  vendorContact: string;
  additionalNotes: string;
  followUpDraft: string;
  submittedAt: string | null;
  emails: Email[];
  products: Product[];
}
export interface RequestedPart {
  partNumber: string;
  nsn: string;
  quantities: number[];
}
export interface Issue {
  id: string;
  productId: string;
  kind:
    "alternate" | "missing" | "no-bid" | "extra" | "quantity" | "arithmetic";
  title: string;
  detail: string;
}
export interface SourceBlock {
  text: string;
  partNumber?: string;
}
