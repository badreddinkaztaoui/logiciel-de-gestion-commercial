import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Package,
  Tag,
  ShoppingCart,
  AlertCircle,
  CheckCircle,
  Loader,
  Percent,
  DollarSign,
  X
} from 'lucide-react';
import { wooCommerceService, WooCommerceProduct } from '../services/woocommerce';
import { formatCurrency } from '../utils/formatters';

// Define interface for product with quantity
export interface ProductWithQuantity extends WooCommerceProduct {
  quantity: number;
  taxRate: number;
  buyPrice: number;
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
  const [buyPrice, setBuyPrice] = useState(0);
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
    const sellPriceTTC = parseFloat(product.price);
    const suggestedBuyPrice = round2(sellPriceTTC * 0.8);
    setBuyPrice(suggestedBuyPrice);

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
    if (selectedProduct && quantity > 0 && buyPrice > 0) {
      if (!allowQuantityOverStock &&
          selectedProduct.manage_stock &&
          selectedProduct.stock_quantity !== null &&
          quantity > selectedProduct.stock_quantity) {
        alert(`Quantité supérieure au stock disponible (${selectedProduct.stock_quantity})`);
        return;
      }

      // Get tax rate for this product
      const taxRate = selectedTaxRate;

      // Create product with quantity, tax rate and buy price
      const productWithQuantity: ProductWithQuantity = {
        ...selectedProduct,
        quantity: quantity,
        taxRate: taxRate,
        buyPrice: buyPrice
      };

      onSelect(productWithQuantity);
      setSelectedProduct(null);
      setQuantity(1);
      setSelectedTaxRate(20);
      setBuyPrice(0);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Rechercher un produit WooCommerce
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Les prix WooCommerce (TTC) sont conservés. Le sous-total HT et la TVA sont calculés automatiquement selon la classe de taxe.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-hidden flex">
          {/* Search and Products List */}
          <div className="flex-1 pr-6">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Products List */}
            <div className="h-96 overflow-y-auto border border-gray-200 rounded-lg">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="ml-2 text-gray-600">Recherche en cours...</span>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full text-red-600">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  {error}
                </div>
              ) : products.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {products.map((product) => {
                    const stockInfo = getStockStatus(product);
                    const priceInfo = getProductPriceInfo(product);
                    const isSelected = selectedProduct?.id === product.id;

                    return (
                      <div
                        key={product.id}
                        onClick={() => handleProductSelect(product)}
                        className={`p-4 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50 border-r-4 border-blue-500' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          {product.images && product.images[0] ? (
                            <img
                              src={product.images[0].src}
                              alt={product.images[0].alt || product.name}
                              className="w-12 h-12 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                              <Package className="w-6 h-6 text-gray-400" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {product.name}
                            </h4>
                            {product.sku && (
                              <p className="text-sm text-gray-500 flex items-center mt-1">
                                <Tag className="w-3 h-3 mr-1" />
                                SKU: {product.sku}
                              </p>
                            )}

                            {/* Price and Tax Information */}
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-blue-600">
                                  Prix TTC: {formatCurrency(priceInfo.priceTTC)}
                                </span>
                                <div className="flex items-center space-x-1">
                                  {getStockIcon(stockInfo.status)}
                                  <span className={`text-xs ${stockInfo.color}`}>
                                    {stockInfo.text}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs text-gray-600">
                                <span className="flex items-center">
                                  <DollarSign className="w-3 h-3 mr-1" />
                                  Prix HT: {formatCurrency(priceInfo.priceHT)}
                                </span>
                                <span className="flex items-center">
                                  <Percent className="w-3 h-3 mr-1" />
                                  TVA {priceInfo.taxRate}%: {formatCurrency(priceInfo.taxAmount)}
                                </span>
                              </div>

                              {product.tax_class && (
                                <div className="text-xs text-gray-500">
                                  Classe TVA: "{product.tax_class || 'standard'}"
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : searchTerm ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Package className="w-8 h-8 mb-2" />
                  <p>Aucun produit trouvé</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Package className="w-8 h-8 mb-2" />
                  <p>Commencez à taper pour rechercher des produits</p>
                </div>
              )}
            </div>
          </div>

          {/* Product Details and Configuration */}
          <div className="w-96 border-l border-gray-200 pl-6 overflow-y-auto">
            {selectedProduct ? (
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Configuration du produit</h4>

                {/* Product Image */}
                {selectedProduct.images && selectedProduct.images[0] ? (
                  <img
                    src={selectedProduct.images[0].src}
                    alt={selectedProduct.images[0].alt || selectedProduct.name}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                    <Package className="w-12 h-12 text-gray-400" />
                  </div>
                )}

                {/* Product Info */}
                <div className="space-y-2">
                  <h5 className="font-medium text-gray-900">{selectedProduct.name}</h5>
                  {selectedProduct.sku && (
                    <p className="text-sm text-gray-600">SKU: {selectedProduct.sku}</p>
                  )}

                  {/* Stock Status */}
                  <div className="flex items-center space-x-2">
                    {getStockIcon(getStockStatus(selectedProduct).status)}
                    <span className={`text-sm ${getStockStatus(selectedProduct).color}`}>
                      {getStockStatus(selectedProduct).text}
                    </span>
                  </div>

                  {/* Categories */}
                  {selectedProduct.categories && selectedProduct.categories.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600">Catégories:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedProduct.categories.map((category) => (
                          <span
                            key={category.id}
                            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                          >
                            {category.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tax Rate Selection */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Taux de TVA à appliquer
                  </label>
                  <select
                    value={selectedTaxRate}
                    onChange={(e) => setSelectedTaxRate(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={0}>0% (Exonéré)</option>
                    <option value={7}>7% (Taux super réduit)</option>
                    <option value={10}>10% (Taux réduit)</option>
                    <option value={20}>20% (Taux normal)</option>
                  </select>
                  {selectedProduct.tax_class && (
                    <p className="text-xs text-blue-600 mt-1">
                      Classe WooCommerce: "{selectedProduct.tax_class || 'standard'}"
                      {selectedTaxRate !== wooCommerceService.getTaxRateForClass(selectedProduct.tax_class) && (
                        <span className="ml-1 text-orange-600">(modifié)</span>
                      )}
                    </p>
                  )}
                </div>

                {/* Buy Price Input */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prix d'achat HT
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(parseFloat(e.target.value) || 0)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-gray-500">MAD</span>
                  </div>
                  <p className="text-xs text-yellow-600 mt-1">
                    Prix de vente TTC WooCommerce: {formatCurrency(parseFloat(selectedProduct.price))}
                  </p>
                </div>

                {/* Price Display - TTC prices are kept as-is */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h6 className="font-medium text-green-900 mb-3">Prix WooCommerce (TTC conservé)</h6>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-700">Prix unitaire TTC:</span>
                      <span className="font-medium text-blue-600">{formatCurrency(round2(parseFloat(selectedProduct.price)))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Prix unitaire HT:</span>
                      <span className="font-medium">{formatCurrency(round2(parseFloat(selectedProduct.price) / (1 + selectedTaxRate / 100)))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">TVA ({selectedTaxRate}%):</span>
                      <span className="font-medium text-blue-600">
                        {formatCurrency(round2((parseFloat(selectedProduct.price) / (1 + selectedTaxRate / 100)) * (selectedTaxRate / 100)))}
                      </span>
                    </div>
                    <div className="text-xs text-green-600 mt-2 font-medium border-t pt-2">
                      ✓ Prix TTC conservé (comme WooCommerce)
                    </div>
                  </div>
                </div>

                {/* Quantity Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantité
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {selectedProduct.manage_stock && selectedProduct.stock_quantity !== null && quantity > selectedProduct.stock_quantity && (
                    <p className="text-orange-500 text-xs mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Commande de {quantity - selectedProduct.stock_quantity} unité(s) en plus du stock actuel ({selectedProduct.stock_quantity})
                    </p>
                  )}
                </div>

                {/* Total Calculation - TTC pricing */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h6 className="font-medium text-gray-900 mb-2">Total de la ligne</h6>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Total HT:</span>
                      <span className="font-medium">{formatCurrency(round2(buyPrice * quantity))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">TVA ({selectedTaxRate}%):</span>
                      <span className="font-medium">{formatCurrency(round2((buyPrice * quantity) * (selectedTaxRate / 100)))}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1">
                      <span className="font-bold text-gray-900">Total TTC:</span>
                      <span className="text-lg font-bold text-blue-600">
                        {formatCurrency(round2((buyPrice * quantity) * (1 + selectedTaxRate / 100)))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Sélectionnez un produit</p>
                  <p className="text-xs mt-1">pour voir les prix TTC</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
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