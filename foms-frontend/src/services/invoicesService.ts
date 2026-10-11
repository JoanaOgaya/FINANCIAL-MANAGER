import { createResource } from './resource';
import type { Invoice } from '../types/entities';

export const invoicesService = createResource<Invoice>('/invoices');
