import { supabase } from '../lib/supabase';
import { SalesJournal, SalesJournalLine, WooCommerceOrder } from '../types';
import { orderService } from './orderService';
import { documentNumberingService } from './documentNumberingService';

class SalesJournalService {
  private readonly TABLE_NAME = 'sales_journal';

  private mapDatabaseToSalesJournal(row: any): SalesJournal {
    return {
      id: row.id,
      number: row.number,
      date: row.date,
      createdAt: row.created_at,
      status: row.status,
      ordersIncluded: row.orders_included,
      lines: row.lines,
      totals: row.totals,
      notes: row.notes
    };
  }

  private async mapSalesJournalToDatabase(journal: SalesJournal): Promise<any> {
    let isoDate = journal.date;

    if (journal.date.includes('/')) {
      const [day, month, year] = journal.date.split('/');
      if (day && month && year) {
        isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    else if (!journal.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error(`Invalid date format: ${journal.date}. Expected DD/MM/YYYY or YYYY-MM-DD`);
    }

    return {
      id: journal.id,
      number: journal.number,
      date: isoDate,
      status: journal.status,
      orders_included: journal.ordersIncluded,
      lines: journal.lines,
      totals: journal.totals,
      notes: journal.notes
    };
  }

  private round2(num: number): number {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  async getSalesJournals(): Promise<SalesJournal[]> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sales journals:', error);
        throw error;
      }

      return (data || []).map(this.mapDatabaseToSalesJournal);
    } catch (error) {
      console.error('Error loading sales journals:', error);
      return [];
    }
  }

  async getSalesJournalById(id: string): Promise<SalesJournal | null> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data ? this.mapDatabaseToSalesJournal(data) : null;
    } catch (error) {
      console.error('Error getting sales journal by ID:', error);
      return null;
    }
  }

  async getSalesJournalByDate(date: string): Promise<SalesJournal | null> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('date', date)
        .maybeSingle();

      if (error) {
        console.error('Error getting sales journal by date:', error);
        throw error;
      }

      return data ? this.mapDatabaseToSalesJournal(data) : null;
    } catch (error) {
      console.error('Error getting sales journal by date:', error);
      return null;
    }
  }

  async generateJournalNumber(journalId: string): Promise<string> {
    try {
      return await documentNumberingService.generateNumber('SALES_JOURNAL', undefined, journalId);
    } catch (error) {
      console.error('Error generating journal number:', error);
      throw error;
    }
  }

  async previewNextJournalNumber(year?: number): Promise<string> {
    try {
      return await documentNumberingService.generatePreviewNumber('SALES_JOURNAL', year);
    } catch (error) {
      console.error('Error generating preview number:', error);
      throw error;
    }
  }

  async saveSalesJournal(journal: SalesJournal): Promise<SalesJournal> {
    try {
      const journalData = await this.mapSalesJournalToDatabase(journal);

      if (!journal.id) {
        journalData.id = crypto.randomUUID();

        // Generate journal number if not provided
        if (!journal.number) {
          journalData.number = await this.generateJournalNumber(journalData.id);
        }
      }

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .upsert(journalData)
        .select()
        .single();

      if (error) {
        console.error('Error saving sales journal:', error);
        throw error;
      }

      return this.mapDatabaseToSalesJournal(data);
    } catch (error) {
      console.error('Error saving sales journal:', error);
      throw error;
    }
  }

  async deleteSalesJournal(journalId: string): Promise<void> {
    try {
      const journal = await this.getSalesJournalById(journalId);
      if (!journal) {
        throw new Error('Journal not found');
      }

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', journalId);

      if (error) {
        console.error('Error deleting sales journal:', error);
        throw error;
      }

      if (journal.number) {
        try {
          await documentNumberingService.deleteNumber(journal.number);
        } catch (error) {
          console.error('Error deleting journal number:', error);
        }
      }
    } catch (error) {
      console.error('Error deleting sales journal:', error);
      throw error;
    }
  }

  async generateSalesJournal(date: string): Promise<{ journal: SalesJournal | null; ordersFound: boolean }> {
    console.log(`Generating sales journal for date: ${date}`);

    try {
      const [day, month, year] = date.split('/');
      if (!day || !month || !year) {
        console.error('Invalid date format:', date);
        throw new Error(`Invalid date format. Expected DD/MM/YYYY but got: ${date}`);
      }

      const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

      console.log('Debug info:', {
        inputDate: date,
        formattedDate
      });

      const ordersForDate = await orderService.getOrdersForDate(formattedDate);

      console.log(`Found ${ordersForDate.length} orders for date ${date}`);

      if (ordersForDate.length === 0) {
        return { journal: null, ordersFound: false };
      }

      const journalLines: SalesJournalLine[] = [];
      const orderIds: number[] = [];

      ordersForDate.forEach((order: WooCommerceOrder) => {
        orderIds.push(order.id);

        const customerName = order.billing ?
          `${order.billing.first_name || ''} ${order.billing.last_name || ''}`.trim() :
          'Unknown Customer';

        if (order.line_items) {
          order.line_items.forEach((lineItem) => {
            const itemTotalTTC = parseFloat(lineItem.total || '0') + parseFloat(lineItem.total_tax || '0');
            const itemTax = parseFloat(lineItem.total_tax || '0');
            const itemTotalHT = itemTotalTTC - itemTax;
            const unitPriceTTC = this.round2(itemTotalTTC / (lineItem.quantity || 1));
            const unitPriceHT = this.round2(itemTotalHT / (lineItem.quantity || 1));

            let taxRate = 20;
            if (itemTotalHT > 0 && itemTax >= 0) {
              if (itemTax === 0) {
                taxRate = 0;
              } else {
                const calculatedRate = this.round2((itemTax / itemTotalHT) * 100);
                const validRates = [0, 7, 10, 20];
                taxRate = validRates.reduce((prev, curr) =>
                  Math.abs(curr - calculatedRate) < Math.abs(prev - calculatedRate) ? curr : prev
                );
              }
            }

            const journalLine: SalesJournalLine = {
              id: `${order.id}-${lineItem.id}`,
              orderId: order.id,
              orderNumber: order.number || order.id.toString(),
              lineItemId: lineItem.id,
              productId: lineItem.product_id,
              sku: lineItem.sku || `PROD-${lineItem.product_id}`,
              productName: lineItem.name,
              quantity: lineItem.quantity,
              unitPriceTTC: unitPriceTTC,
              totalTTC: itemTotalTTC,
              taxRate: taxRate,
              unitPriceHT: unitPriceHT,
              totalHT: itemTotalHT,
              taxAmount: itemTax,
              customerName: customerName,
              customerEmail: order.billing?.email
            };

            journalLines.push(journalLine);
          });
        }
      });

      const totalHT = this.round2(journalLines.reduce((sum, line) => sum + line.totalHT, 0));
      const totalTTC = this.round2(journalLines.reduce((sum, line) => sum + line.totalTTC, 0));

      const taxBreakdownMap = new Map<number, { base: number; amount: number }>();

      journalLines.forEach(line => {
        const rate = line.taxRate;
        if (!taxBreakdownMap.has(rate)) {
          taxBreakdownMap.set(rate, { base: 0, amount: 0 });
        }
        const current = taxBreakdownMap.get(rate)!;
        current.base = this.round2(current.base + line.totalHT);
        current.amount = this.round2(current.amount + line.taxAmount);
      });

      const taxBreakdown = Array.from(taxBreakdownMap.entries())
        .map(([rate, data]) => ({
          rate,
          base: data.base,
          amount: data.amount
        }))
        .filter(item => item.base > 0)
        .sort((a, b) => a.rate - b.rate);

      const salesJournal: SalesJournal = {
        id: crypto.randomUUID(),
        number: await documentNumberingService.generateNumber(
          'SALES_JOURNAL',
          undefined,
          crypto.randomUUID()
        ),
        date: date,
        createdAt: new Date().toISOString(),
        status: 'draft',
        ordersIncluded: orderIds,
        lines: journalLines,
        totals: {
          totalHT,
          totalTTC,
          taxBreakdown
        },
        notes: `Journal de vente généré automatiquement pour le ${new Date(date).toLocaleDateString('fr-FR')}. Inclut ${ordersForDate.length} commande(s) et ${journalLines.length} ligne(s) de produits.`
      };

      console.log(`Sales journal generated:`, {
        date,
        ordersCount: ordersForDate.length,
        linesCount: journalLines.length,
        totalHT,
        totalTTC,
        taxBreakdown: taxBreakdown.length
      });

      return { journal: salesJournal, ordersFound: true };
    } catch (error) {
      console.error('Error generating sales journal:', error);
      throw error;
    }
  }

  async journalExistsForDate(date: string): Promise<boolean> {
    const journal = await this.getSalesJournalByDate(date);
    return journal !== null;
  }

  async getJournalStats() {
    try {
      const journals = await this.getSalesJournals();

      return {
        total: journals.length,
        draft: journals.filter(j => j.status === 'draft').length,
        validated: journals.filter(j => j.status === 'validated').length,
        totalValue: journals.reduce((sum, j) => sum + j.totals.totalTTC, 0),
        totalLines: journals.reduce((sum, j) => sum + j.lines.length, 0)
      };
    } catch (error) {
      console.error('Error getting journal stats:', error);
      return {
        total: 0,
        draft: 0,
        validated: 0,
        totalValue: 0,
        totalLines: 0
      };
    }
  }

  async validateJournal(journalId: string): Promise<void> {
    try {
      const journal = await this.getSalesJournalById(journalId);
      if (!journal) {
        throw new Error(`Journal with ID ${journalId} not found`);
      }

      if (journal.status !== 'draft') {
        throw new Error(`Journal ${journal.number} is already validated`);
      }

      const existingJournal = await this.getSalesJournalByDate(journal.date);
      if (existingJournal && existingJournal.id !== journal.id) {
        throw new Error(`Another journal already exists for date ${journal.date}`);
      }

      journal.status = 'validated';
      await this.saveSalesJournal(journal);
    } catch (error) {
      console.error('Error validating journal:', error);
      throw error instanceof Error ? error : new Error('Unknown error occurred while validating journal');
    }
  }

  async getJournalsForDateRange(startDate: string, endDate: string): Promise<SalesJournal[]> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching journals for date range:', error);
        throw error;
      }

      return (data || []).map(this.mapDatabaseToSalesJournal);
    } catch (error) {
      console.error('Error getting journals for date range:', error);
      return [];
    }
  }

  async exportJournalForAccounting(journalId: string) {
    try {
      const journal = await this.getSalesJournalById(journalId);
      if (!journal) return null;

      const csvData = [
        ['Date', 'N° Journal', 'N° Commande', 'SKU', 'Produit', 'Client', 'Quantité', 'Prix Unit. TTC', 'Total TTC', 'Prix Unit. HT', 'Total HT', 'Taux TVA', 'Montant TVA'],
        ...journal.lines.map(line => [
          journal.date,
          journal.number,
          line.orderNumber,
          line.sku,
          line.productName,
          line.customerName,
          line.quantity.toString(),
          line.unitPriceTTC.toFixed(2),
          line.totalTTC.toFixed(2),
          line.unitPriceHT.toFixed(2),
          line.totalHT.toFixed(2),
          `${line.taxRate}%`,
          line.taxAmount.toFixed(2)
        ])
      ];

      return {
        csvData,
        totals: journal.totals,
        summary: {
          date: journal.date,
          number: journal.number,
          ordersCount: journal.ordersIncluded.length,
          linesCount: journal.lines.length
        }
      };
    } catch (error) {
      console.error('Error exporting journal for accounting:', error);
      return null;
    }
  }

  async updateJournalForOrder(orderId: number): Promise<void> {
    try {
      // Find journals containing this order
      const { data: journals, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .contains('ordersIncluded', [orderId]);

      if (error) {
        console.error('Error finding journals for order:', error);
        return;
      }

      // Regenerate each affected journal
      for (const journal of journals) {
        const date = new Date(journal.date).toLocaleDateString('fr-FR');
        const { journal: updatedJournal } = await this.generateSalesJournal(date);

        if (updatedJournal) {
          await this.saveSalesJournal(updatedJournal);
        }
      }
    } catch (error) {
      console.error('Error updating journal for order:', error);
      throw error;
    }
  }
}

export const salesJournalService = new SalesJournalService();