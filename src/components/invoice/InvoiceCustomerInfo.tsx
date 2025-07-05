import React from 'react';
import { Search } from 'lucide-react';
import { Customer } from '../../types/index';

interface InvoiceCustomerInfoProps {
  customer: {
    name: string;
    email: string;
    company: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  customers: Customer[];
  customerSearchTerm: string;
  selectedCustomerId: string;
  errors: { [key: string]: string };
  onCustomerChange: (field: string, value: string) => void;
  onCustomerSelect: (customerId: string) => void;
  onSearchTermChange: (term: string) => void;
  isEditMode: boolean;
}

const InvoiceCustomerInfo: React.FC<InvoiceCustomerInfoProps> = ({
  customer,
  customers,
  customerSearchTerm,
  errors,
  onCustomerChange,
  onCustomerSelect,
  onSearchTermChange,
  isEditMode
}) => {
  const filteredCustomers = customers.filter(customer => {
    if (!customer || !customerSearchTerm) return false;
    const searchLower = customerSearchTerm.toLowerCase();
    return (
      (customer.firstName && customer.firstName.toLowerCase().includes(searchLower)) ||
      (customer.lastName && customer.lastName.toLowerCase().includes(searchLower)) ||
      (customer.email && customer.email.toLowerCase().includes(searchLower)) ||
      (customer.company && customer.company.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Informations client</h2>

      {!isEditMode && customers.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sélectionner un client existant (optionnel)
          </label>
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={customerSearchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {customerSearchTerm && filteredCustomers.length > 0 && (
            <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredCustomers.slice(0, 5).map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => {
                    onCustomerSelect(customer.id);
                    onSearchTermChange('');
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <p className="text-sm font-medium text-gray-900">
                    {customer.firstName} {customer.lastName}
                  </p>
                  {customer.email && (
                    <p className="text-xs text-gray-500">{customer.email}</p>
                  )}
                  {customer.company && (
                    <p className="text-xs text-gray-500">{customer.company}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nom du client *
          </label>
          <input
            type="text"
            value={customer.name}
            onChange={(e) => onCustomerChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            placeholder="Nom complet du client"
          />
          {errors.customerName && <p className="text-red-500 text-sm mt-1">{errors.customerName}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <input
            type="email"
            value={customer.email}
            onChange={(e) => onCustomerChange('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="email@exemple.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Entreprise
          </label>
          <input
            type="text"
            value={customer.company}
            onChange={(e) => onCustomerChange('company', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Nom de l'entreprise"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Adresse
          </label>
          <input
            type="text"
            value={customer.address}
            onChange={(e) => onCustomerChange('address', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Adresse complète"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ville
          </label>
          <input
            type="text"
            value={customer.city}
            onChange={(e) => onCustomerChange('city', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ville"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Code postal
          </label>
          <input
            type="text"
            value={customer.postalCode}
            onChange={(e) => onCustomerChange('postalCode', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Code postal"
          />
        </div>
      </div>
    </div>
  );
};

export default InvoiceCustomerInfo;