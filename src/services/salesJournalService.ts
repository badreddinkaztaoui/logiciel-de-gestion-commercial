import { supabase } from '../lib/supabase';
import { SalesJournal, SalesJournalLine } from '../types';
import { orderService } from './orderService';
import { generateDocumentNumber } from '../utils/formatters';

class SalesJournalService {
  private readonly TABLE_NAME = 'sales_journal';

  private async ensureAuthenticated(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    console.log('Auth check:', { user, error });
    if (error || !user) {
      throw new Error('User must be authenticated to perform this operation');
    }
    return user.id;
  }

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
    const userId = await this.ensureAuthenticated();
    return {
      id: journal.id,
      number: journal.number,
      date: journal.date,
      status: journal.status,
      orders_included: journal.ordersIncluded,
      lines: journal.lines,
      totals: journal.totals,
      notes: journal.notes,
      user_id: userId
    };
  }

  private round2(num: number): number {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  async getSalesJournals(): Promise<SalesJournal[]> {
    try {
      await this.ensureAuthenticated();

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
      await this.ensureAuthenticated();

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
      await this.ensureAuthenticated();

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

  async saveSalesJournal(journal: SalesJournal): Promise<SalesJournal> {
    try {
      await this.ensureAuthenticated();

      const journalData = await this.mapSalesJournalToDatabase(journal);

      if (!journal.id) {
        journalData.id = crypto.randomUUID();
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
      await this.ensureAuthenticated();

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', journalId);

      if (error) {
        console.error('Error deleting sales journal:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error deleting sales journal:', error);
      throw error;
    }
  }

  async generateSalesJournal(date: string): Promise<SalesJournal> {
    console.log(`Generating sales journal for date: ${date}`);

    try {
      const allOrders = await orderService.getOrders();

      const ordersForDate = allOrders.filter(order => {
        const orderDate = new Date(order.date_created).toISOString().split('T')[0];
        return orderDate === date;
      });

      console.log(`Found ${ordersForDate.length} orders for date ${date}`);

      const journalLines: SalesJournalLine[] = [];
      const orderIds: number[] = [];

      ordersForDate.forEach(order => {
        orderIds.push(order.id);

        const customerName = `${order.billing.first_name} ${order.billing.last_name}`.trim();

        order.line_items.forEach(lineItem => {
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
            customerEmail: order.billing.email
          };

          journalLines.push(journalLine);
        });
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

      // Get the next number using the settings service
      const number = await generateDocumentNumber('SALES_JOURNAL');

      const salesJournal: SalesJournal = {
        id: crypto.randomUUID(),
        number,
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

      return salesJournal;
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
      if (journal && journal.status === 'draft') {
        journal.status = 'validated';
        await this.saveSalesJournal(journal);
      }
    } catch (error) {
      console.error('Error validating journal:', error);
      throw error;
    }
  }

  async getJournalsForDateRange(startDate: string, endDate: string): Promise<SalesJournal[]> {
    try {
      await this.ensureAuthenticated();

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
}

export const salesJournalService = new SalesJournalService();