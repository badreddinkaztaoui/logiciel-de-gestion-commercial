import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Package,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react';
import { wooCommerceService, WooCommerceProduct } from '../services/woocommerce';
import { formatCurrency } from '../utils/formatters';

// Define interface for product with quantity
export interface ProductWithQuantity extends WooCommerceProduct {
  quantity: number;
  taxRate: number;
}

interface ProductSearchProps {
  onSelect: (product: ProductWithQuantity) => void;
  onClose: () => void;
  allowQuantityOverStock?: boolean;
}

const ProductSearch: React.FC<ProductSearchProps> = ({
  onSelect,
  onClose,
  allowQuantityOverStock = true
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<WooCommerceProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<WooCommerceProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedTaxRate, setSelectedTaxRate] = useState(20); // Default tax rate
  const [error, setError] = useState<string | null>(null);

  // Helper function to round to 2 decimal places
  const round2 = (num: number): number => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  };

  const searchProducts = async (search?: string) => {
    if (!search && !searchTerm) return;

    setLoading(true);
    try {
      setError(null);
      const results = await wooCommerceService.searchProducts({
        search: search || searchTerm,
        per_page: 20,
        status: 'publish'
      });
      setProducts(results);
    } catch (error) {
      console.error('Error searching products:', error);
      setError('Une erreur est survenue lors de la recherche des produits');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchProducts('');
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm) {
        searchProducts();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleProductSelect = async (product: WooCommerceProduct) => {
    setSelectedProduct(product);

    try {
      const taxRate = wooCommerceService.getTaxRateForClass(product.tax_class || '');
      setSelectedTaxRate(taxRate);
      console.log(`Product ${product.name} has tax class "${product.tax_class}" -> rate: ${taxRate}%`);
    } catch (error) {
      console.error('Error getting tax rate for product:', error);
      setSelectedTaxRate(20); // Default to 20% if error
    }
  };

  const handleAddProduct = () => {
    if (selectedProduct && quantity > 0) {
      if (!allowQuantityOverStock &&
          selectedProduct.manage_stock &&
          selectedProduct.stock_quantity !== null &&
          quantity > selectedProduct.stock_quantity) {
        alert(`Quantité supérieure au stock disponible (${selectedProduct.stock_quantity})`);
        return;
      }

      // Get tax rate for this product
      const taxRate = selectedTaxRate;

      // Create product with quantity and tax rate
      const productWithQuantity: ProductWithQuantity = {
        ...selectedProduct,
        quantity: quantity,
        taxRate: taxRate
      };

      onSelect(productWithQuantity);
      setSelectedProduct(null);
      setQuantity(1);
      setSelectedTaxRate(20);
      onClose();
    }
  };

  const getStockStatus = (product: WooCommerceProduct) => {
    if (!product.manage_stock) {
      return { status: 'instock', text: 'En stock', color: 'text-green-600' };
    }

    const stock = product.stock_quantity || 0;
    if (stock === 0) {
      return { status: 'outofstock', text: 'Rupture de stock', color: 'text-red-600' };
    } else if (stock <= 5) {
      return { status: 'lowstock', text: `Stock faible (${stock})`, color: 'text-orange-600' };
    } else {
      return { status: 'instock', text: `En stock (${stock})`, color: 'text-green-600' };
    }
  };

  const getStockIcon = (status: string) => {
    switch (status) {
      case 'instock':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'lowstock':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'outofstock':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Package className="w-4 h-4 text-gray-500" />;
    }
  };

  // Get product price info - WooCommerce prices are TTC, we keep them TTC
  const getProductPriceInfo = (product: WooCommerceProduct) => {
    const priceTTC = round2(parseFloat(product.price)); // WooCommerce price is TTC
    const taxRate = selectedProduct?.id === product.id ? selectedTaxRate : wooCommerceService.getTaxRateForClass(product.tax_class || '');
    const priceHT = round2(priceTTC / (1 + taxRate / 100)); // Calculate HT from TTC for information
    const taxAmount = round2(priceHT * (taxRate / 100));

    return {
      priceTTC,
      priceHT,
      taxRate,
      taxAmount
    };
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Rechercher un produit</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nom du produit, SKU..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8 text-red-600">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleProductSelect(product)}
                  className={`flex items-start p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left ${
                    selectedProduct?.id === product.id ? 'ring-2 ring-blue-500 border-blue-500' : ''
                  }`}
                >
                  <Package className="w-5 h-5 text-gray-400 mt-1 mr-4" />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{product.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">SKU: {product.sku || 'N/A'}</p>

                    {/* Price and Tax Information */}
                    {(() => {
                      const { priceTTC, priceHT, taxRate } = getProductPriceInfo(product);
                      return (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Prix HT:</span>
                            <span className="text-sm font-medium text-gray-900">{formatCurrency(priceHT)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">TVA ({taxRate}%):</span>
                            <span className="text-sm text-gray-900">{formatCurrency(priceTTC - priceHT)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">Prix TTC:</span>
                            <span className="text-sm font-medium text-gray-900">{formatCurrency(priceTTC)}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Stock Status */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center">
                        {getStockIcon(getStockStatus(product).status)}
                        <span className={`ml-2 text-sm ${getStockStatus(product).color}`}>
                          {getStockStatus(product).text}
                        </span>
                      </div>

                      {/* Quantity Input - Only show for selected product */}
                      {selectedProduct?.id === product.id && (
                        <div className="flex items-center space-x-2">
                          <label className="text-sm text-gray-500">Quantité:</label>
                          <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* Show warning if quantity exceeds stock */}
                    {selectedProduct?.id === product.id &&
                    !allowQuantityOverStock &&
                    product.manage_stock &&
                    product.stock_quantity !== null &&
                    quantity > product.stock_quantity && (
                      <p className="mt-2 text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        Stock disponible: {product.stock_quantity}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : searchTerm ? (
            <div className="text-center py-8 text-gray-500">
              Aucun produit trouvé
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Commencez à taper pour rechercher des produits
            </div>
          )}
        </div>

        {/* Product Details and Configuration */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleAddProduct}
            disabled={!selectedProduct || quantity <= 0}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter à la facture</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductSearch;