import { supabase } from '../lib/supabase';

export interface CompanySettings {
  name: string;
  logo: string;
  description: string;
  ice: string;
  rc: string;
  cnss: string;
  if: string;
  patente: string;
  rib: string;
  footerAddress: string;
  footerEmail: string;
  footerWebsite: string;
  telephone: string;
}

interface DocumentNumberingSettings {
  startNumber: number;
  currentNumber: number;
  resetPeriod: 'never' | 'yearly' | 'monthly';
}

export interface NumberingSettings {
  INVOICE: DocumentNumberingSettings;
  DELIVERY: DocumentNumberingSettings;
  RETURN: DocumentNumberingSettings;
  QUOTE: DocumentNumberingSettings;
  SALES_JOURNAL: DocumentNumberingSettings;
  PURCHASE_ORDER: DocumentNumberingSettings;
}

export interface TemplateSettings {
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  headerBackgroundColor: string;
  showLogo: boolean;
  logoSize: 'small' | 'medium' | 'large';
  fontSize: 'small' | 'medium' | 'large';
  currency: string;
  language: string;
  taxRate: number;
  taxLabel: string;
  showTaxNumber: boolean;
  showRegistrationNumber: boolean;
}

export interface WooCommerceSettings {
  autoSync: boolean;
  syncInterval: number;
  updateOrderStatus: boolean;
  notifyCustomers: boolean;
  stockManagement: boolean;
}

export interface DeliverySettings {
  defaultDeliveryDays: number;
  defaultCarrier: string;
  availableCarriers: string[];
  autoMarkInTransit: boolean;
  notifyCustomersOnShipping: boolean;
  trackingEnabled: boolean;
  defaultNotes: string;
}

export interface ReturnSettings {
  returnPeriodDays: number;
  autoApproveReturns: boolean;
  defaultReturnReasons: string[];
  stockUpdatePolicy: 'immediate' | 'after_approval' | 'manual';
  refundPolicy: 'full' | 'condition_based' | 'manual';
  notifyCustomersOnReturn: boolean;
  defaultNotes: string;
}

export interface LegalSettings {
  termsAndConditions: string;
  paymentTerms: string;
  bankDetails: string;
  footerText: string;
  legalMentions: string;
  returnPolicy: string;
  shippingPolicy: string;
}

export interface AllSettings {
  company: CompanySettings;
  numbering: NumberingSettings;
  template: TemplateSettings;
  woocommerce: WooCommerceSettings;
  delivery: DeliverySettings;
  returns: ReturnSettings;
  legal: LegalSettings;
}

class SettingsService {
  private readonly TABLE_NAME = 'settings';
  private settingsCache: AllSettings | null = null;

  /**
   * Ensure user is authenticated
   */
  private async ensureAuthenticated(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User must be authenticated to perform this operation');
    }
    return user.id;
  }

  private defaultSettings: AllSettings = {
    company: {
      name: '',
      logo: 'https://pub-237d2da54b564d23aaa1c3826e1d4e65.r2.dev/gepronet/gepronet.png',
      description: '',
      ice: '000046099000031',
      rc: '99139',
      cnss: '9639595',
      if: '3366970',
      patente: '25 790761',
      rib: '021 810 0000 069 030 27084 9 37',
      footerAddress: '15, Avenue Al Abtal, Appt N°4 Agdal - Rabat - 10000 - Maroc',
      footerEmail: 'contact@rabatcommerce.com',
      footerWebsite: 'www.rabatcommerce.com',
      telephone: '0661 - 201- 500'
    },
    numbering: {
      INVOICE: {
        startNumber: 1,
        currentNumber: 1,
        resetPeriod: 'yearly'
      },
      DELIVERY: {
        startNumber: 1,
        currentNumber: 1,
        resetPeriod: 'yearly'
      },
      RETURN: {
        startNumber: 1,
        currentNumber: 1,
        resetPeriod: 'yearly'
      },
      QUOTE: {
        startNumber: 1,
        currentNumber: 1,
        resetPeriod: 'yearly'
      },
      SALES_JOURNAL: {
        startNumber: 1,
        currentNumber: 1,
        resetPeriod: 'yearly'
      },
      PURCHASE_ORDER: {
        startNumber: 1,
        currentNumber: 1,
        resetPeriod: 'yearly'
      }
    },
    template: {
      primaryColor: '#2563eb',
      secondaryColor: '#64748b',
      textColor: '#000000',
      headerBackgroundColor: '#ffffff',
      showLogo: true,
      logoSize: 'medium',
      fontSize: 'medium',
      currency: 'MAD',
      language: 'fr',
      taxRate: 20,
      taxLabel: 'TVA',
      showTaxNumber: false,
      showRegistrationNumber: false
    },
    woocommerce: {
      autoSync: true,
      syncInterval: 5,
      updateOrderStatus: true,
      notifyCustomers: true,
      stockManagement: true
    },
    delivery: {
      defaultDeliveryDays: 3,
      defaultCarrier: 'Transport interne',
      availableCarriers: ['Transport interne', 'Poste Maroc', 'Amana', 'DHL', 'FedEx'],
      autoMarkInTransit: false,
      notifyCustomersOnShipping: true,
      trackingEnabled: false,
      defaultNotes: 'Livraison pendant les heures ouvrables (9h-17h). Veuillez être présent à l\'adresse indiquée.'
    },
    returns: {
      returnPeriodDays: 30,
      autoApproveReturns: false,
      defaultReturnReasons: [
        'Produit défectueux',
        'Produit endommagé lors de la livraison',
        'Ne correspond pas à la description',
        'Erreur de commande',
        'Client a changé d\'avis',
        'Produit non conforme',
        'Autre'
      ],
      stockUpdatePolicy: 'after_approval',
      refundPolicy: 'condition_based',
      notifyCustomersOnReturn: true,
      defaultNotes: 'Merci de retourner le produit dans son emballage d\'origine avec tous les accessoires.'
    },
    legal: {
      termsAndConditions: '',
      paymentTerms: '',
      bankDetails: '',
      footerText: '',
      legalMentions: '',
      returnPolicy: '',
      shippingPolicy: ''
    }
  };

  async getSettings(): Promise<AllSettings> {
    try {
      if (this.settingsCache) {
        return this.settingsCache;
      }

      const userId = await this.ensureAuthenticated();

      try {
        const { data, error } = await supabase
          .from(this.TABLE_NAME)
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          if (error.code === '42P01') {
            console.warn('Settings table does not exist, creating it...');
            await this.createSettingsTableIfNotExists();
            await this.saveSettings(this.defaultSettings);
            this.settingsCache = this.defaultSettings;
            return this.defaultSettings;
          }
          throw error;
        }

        if (!data) {
          console.log('Creating default settings for user');
          await this.saveSettings(this.defaultSettings);
          this.settingsCache = this.defaultSettings;
          return this.defaultSettings;
        }

        const settings = data?.settings_data || {};
        const merged = {
          company: { ...this.defaultSettings.company, ...settings.company },
          numbering: {
            INVOICE: { ...this.defaultSettings.numbering.INVOICE, ...settings.numbering?.INVOICE },
            DELIVERY: { ...this.defaultSettings.numbering.DELIVERY, ...settings.numbering?.DELIVERY },
            RETURN: { ...this.defaultSettings.numbering.RETURN, ...settings.numbering?.RETURN },
            QUOTE: { ...this.defaultSettings.numbering.QUOTE, ...settings.numbering?.QUOTE },
            SALES_JOURNAL: { ...this.defaultSettings.numbering.SALES_JOURNAL, ...settings.numbering?.SALES_JOURNAL },
            PURCHASE_ORDER: { ...this.defaultSettings.numbering.PURCHASE_ORDER, ...settings.numbering?.PURCHASE_ORDER }
          },
          template: { ...this.defaultSettings.template, ...settings.template },
          woocommerce: { ...this.defaultSettings.woocommerce, ...settings.woocommerce },
          delivery: { ...this.defaultSettings.delivery, ...settings.delivery },
          returns: { ...this.defaultSettings.returns, ...settings.returns },
          legal: { ...this.defaultSettings.legal, ...settings.legal }
        };

        this.settingsCache = merged;
        return merged;
      } catch (error) {
        console.error('Error fetching settings:', error);
        await this.saveSettings(this.defaultSettings);
        this.settingsCache = this.defaultSettings;
        return this.defaultSettings;
      }
    } catch (error) {
      console.error('Error getting settings:', error);
      this.settingsCache = this.defaultSettings;
      return this.defaultSettings;
    }
  }

  async saveSettings(settings: AllSettings): Promise<void> {
    try {
      const userId = await this.ensureAuthenticated();

      await this.createSettingsTableIfNotExists();

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .upsert({
          user_id: userId,
          settings_data: settings,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error saving settings:', error);
        throw error;
      }

      this.settingsCache = settings;
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  private async createSettingsTableIfNotExists(): Promise<void> {
    try {
      const { error } = await supabase.rpc('create_settings_table');
      if (error && error.code !== 'PGRST202') {
        console.error('Error creating settings table:', error);
      }
    } catch (error) {
      console.warn('Could not create settings table:', error);
    }
  }

  async getCompanySettings(): Promise<CompanySettings> {
    const settings = await this.getSettings();
    return settings.company;
  }

  async getNumberingSettings(): Promise<NumberingSettings> {
    const settings = await this.getSettings();
    return settings.numbering;
  }

  async getTemplateSettings(): Promise<TemplateSettings> {
    const settings = await this.getSettings();
    return settings.template;
  }

  async getWooCommerceSettings(): Promise<WooCommerceSettings> {
    const settings = await this.getSettings();
    return settings.woocommerce;
  }

  async getDeliverySettings(): Promise<DeliverySettings> {
    const settings = await this.getSettings();
    return settings.delivery;
  }

  async getReturnSettings(): Promise<ReturnSettings> {
    const settings = await this.getSettings();
    return settings.returns;
  }

  async getLegalSettings(): Promise<LegalSettings> {
    const settings = await this.getSettings();
    return settings.legal;
  }

  async updateCompanySettings(company: Partial<CompanySettings>): Promise<void> {
    const settings = await this.getSettings();
    settings.company = { ...settings.company, ...company };
    await this.saveSettings(settings);
  }

  async updateNumberingSettings(numbering: Partial<NumberingSettings>): Promise<void> {
    const settings = await this.getSettings();
    settings.numbering = { ...settings.numbering, ...numbering };
    await this.saveSettings(settings);
  }

  async updateTemplateSettings(template: Partial<TemplateSettings>): Promise<void> {
    const settings = await this.getSettings();
    settings.template = { ...settings.template, ...template };
    await this.saveSettings(settings);
  }

  async updateWooCommerceSettings(woocommerce: Partial<WooCommerceSettings>): Promise<void> {
    const settings = await this.getSettings();
    settings.woocommerce = { ...settings.woocommerce, ...woocommerce };
    await this.saveSettings(settings);
  }

  async updateDeliverySettings(delivery: Partial<DeliverySettings>): Promise<void> {
    const settings = await this.getSettings();
    settings.delivery = { ...settings.delivery, ...delivery };
    await this.saveSettings(settings);
  }

  async updateReturnSettings(returns: Partial<ReturnSettings>): Promise<void> {
    const settings = await this.getSettings();
    settings.returns = { ...settings.returns, ...returns };
    await this.saveSettings(settings);
  }

  async updateLegalSettings(legal: Partial<LegalSettings>): Promise<void> {
    const settings = await this.getSettings();
    settings.legal = { ...settings.legal, ...legal };
    await this.saveSettings(settings);
  }

  async getNextDocumentNumber(
    documentType: 'INVOICE' | 'DELIVERY' | 'RETURN' | 'QUOTE' | 'SALES_JOURNAL' | 'PURCHASE_ORDER',
    preview: boolean = true
  ): Promise<string> {
    try {
      const settings = await this.getNumberingSettings();
      const docSettings = settings[documentType];

      const nextNumber = docSettings.currentNumber;

      let formattedNumber: string;

      const currentYear = new Date().getFullYear();
      const paddedNumber = nextNumber.toString().padStart(4, '0');

      switch (documentType) {
        case 'SALES_JOURNAL':
          formattedNumber = `F G${currentYear}${paddedNumber}`;
          break;
        case 'INVOICE':
          formattedNumber = `F A${currentYear}${paddedNumber}`;
          break;
        case 'QUOTE':
          formattedNumber = `F D${currentYear}${paddedNumber}`;
          break;
        case 'DELIVERY':
          formattedNumber = `F L${currentYear}${paddedNumber}`;
          break;
        case 'RETURN':
          formattedNumber = `F R${currentYear}${paddedNumber}`;
          break;
        case 'PURCHASE_ORDER':
          formattedNumber = `F PO${currentYear}${paddedNumber}`;
          break;
        default:
          formattedNumber = `DOC-${paddedNumber}`;
      }

      if (!preview) {
        await this.updateNumberingSettings({
          [documentType]: { ...docSettings, currentNumber: nextNumber + 1 }
        });
      }

      return formattedNumber;
    } catch (error) {
      console.error('Error getting next document number:', error);

      const timestamp = Date.now().toString().slice(-6);
      const currentYear = new Date().getFullYear();

      switch (documentType) {
        case 'SALES_JOURNAL':
          return `F G${currentYear}${timestamp}`;
        case 'INVOICE':
          return `F A${currentYear}${timestamp}`;
        case 'QUOTE':
          return `F D${currentYear}${timestamp}`;
        case 'DELIVERY':
          return `F L${currentYear}${timestamp}`;
        case 'RETURN':
          return `F R${currentYear}${timestamp}`;
        case 'PURCHASE_ORDER':
          return `F PO${currentYear}${timestamp}`;
        default:
          return `DOC-${timestamp}`;
      }
    }
  }

  async getAndIncrementDocumentNumber(
    documentType: 'INVOICE' | 'DELIVERY' | 'RETURN' | 'QUOTE' | 'SALES_JOURNAL' | 'PURCHASE_ORDER'
  ): Promise<string> {
    return this.getNextDocumentNumber(documentType, false);
  }

  async getNextInvoiceNumber(): Promise<string> {
    return this.getAndIncrementDocumentNumber('INVOICE');
  }

  async checkAndResetNumbering(): Promise<void> {
    try {
      const { error } = await supabase.rpc('check_reset_document_numbering');
      if (error) {
        if (error.code === 'PGRST202') {
          console.warn('Document numbering reset function not available');
          return;
        }
        console.error('Error checking numbering reset:', error);
      } else {
        this.settingsCache = null;
      }
    } catch (error) {
      console.warn('Could not check document numbering:', error);
    }
  }

  async exportSettings(): Promise<string> {
    const settings = await this.getSettings();
    return JSON.stringify(settings, null, 2);
  }

  async importSettings(settingsJson: string): Promise<boolean> {
    try {
      const settings = JSON.parse(settingsJson);
      await this.saveSettings(settings);
      return true;
    } catch (error) {
      console.error('Error importing settings:', error);
      return false;
    }
  }

  async resetToDefaults(): Promise<void> {
    await this.saveSettings(this.defaultSettings);
  }

  clearCache(): void {
    this.settingsCache = null;
  }
}

export const settingsService = new SettingsService();