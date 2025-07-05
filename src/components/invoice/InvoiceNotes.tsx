import React from 'react';

interface InvoiceNotesProps {
  notes: string;
  onChange: (notes: string) => void;
}

const InvoiceNotes: React.FC<InvoiceNotesProps> = ({ notes, onChange }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
      <textarea
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="Notes additionnelles..."
      />
    </div>
  );
};

export default InvoiceNotes;