import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, Calendar, DollarSign, TrendingDown, TrendingUp, User, X, FileText, CheckCircle } from 'lucide-react';
import { Transaction, TransactionType } from '../types';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { supabase } from '../supabaseClient';

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<TransactionType>('expense');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState<Omit<Transaction, 'id' | 'type'>>({
    person: '',
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.from('transactions').select('*');
      if (data) setTransactions(data as Transaction[]);
      if (error) console.error("Error fetching transactions:", error);
      setIsLoading(false);
    };

    fetchTransactions();

    const channel = supabase
      .channel('schema-db-changes-transactions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenModal = (tx?: Transaction) => {
    if (tx) {
      setEditingTx(tx);
      setFormData({
        person: tx.person,
        description: tx.description,
        amount: tx.amount,
        date: tx.date,
      });
    } else {
      setEditingTx(null);
      setFormData({
        person: '',
        description: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTx(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTx) {
      const { error } = await supabase
        .from('transactions')
        .update({ ...formData, type: activeTab })
        .eq('id', editingTx.id);
      
      if (error) {
        console.error("Error updating:", error);
        alert(`حدث خطأ أثناء التعديل: ${error.message}`);
      }
    } else {
      const { error } = await supabase
        .from('transactions')
        .insert([{ ...formData, type: activeTab }]);
        
      if (error) {
        console.error("Error inserting:", error);
        alert(`حدث خطأ أثناء الإضافة: ${error.message}`);
      }
    }
    handleCloseModal();
  };

  const handleDeleteClick = (id: string) => {
    const skipWarning = localStorage.getItem('skipDeleteWarning') === 'true';
    if (skipWarning) {
      supabase.from('transactions').delete().eq('id', id).then(({ error }) => {
        if (error) console.error("Error deleting:", error);
      });
    } else {
      setItemToDelete(id);
    }
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', itemToDelete);
        
      if (error) console.error("Error deleting:", error);
      setItemToDelete(null);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => t.type === activeTab)
      .filter(t =>
        t.person.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, activeTab, searchQuery]);

  const currentMonthTotal = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return transactions
      .filter(t => t.type === activeTab)
      .filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [transactions, activeTab]);

  const allTimeTotal = useMemo(() => {
    return transactions
      .filter(t => t.type === activeTab)
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [transactions, activeTab]);

  const isExpense = activeTab === 'expense';
  const ThemeIcon = isExpense ? TrendingDown : TrendingUp;
  const tabLabel = isExpense ? 'المصروفات' : 'الواردات';
  const personLabel = isExpense ? 'من قام بالصرف' : 'من قام بالتوريد';
  const amountLabel = isExpense ? 'المبلغ المصروف' : 'المبلغ الوارد';

  const colorClasses = isExpense 
    ? {
        bg: 'bg-red-600',
        hover: 'hover:bg-red-700',
        text: 'text-red-600',
        bgLight: 'bg-red-100',
        ring: 'focus:ring-red-500'
      }
    : {
        bg: 'bg-green-600',
        hover: 'hover:bg-green-700',
        text: 'text-green-600',
        bgLight: 'bg-green-100',
        ring: 'focus:ring-green-500'
      };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
        <button
          onClick={() => setActiveTab('expense')}
          className={`flex-1 flex items-center justify-center py-3 text-sm font-medium rounded-lg transition-colors ${
            isExpense ? 'bg-red-50 text-red-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <TrendingDown className="w-5 h-5 ml-2" />
          المصروفات
        </button>
        <button
          onClick={() => setActiveTab('income')}
          className={`flex-1 flex items-center justify-center py-3 text-sm font-medium rounded-lg transition-colors ${
            !isExpense ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <TrendingUp className="w-5 h-5 ml-2" />
          الواردات
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100">
          <div className="px-4 py-5 sm:p-6 flex items-center">
            <div className={`p-3 rounded-full ${colorClasses.bgLight} ${colorClasses.text} ml-4`}>
              <ThemeIcon className="w-8 h-8" />
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 truncate">إجمالي {tabLabel} (الشهر الحالي)</dt>
              <dd className={`mt-1 text-3xl font-semibold ${colorClasses.text}`}>
                {currentMonthTotal.toLocaleString()} <span className="text-sm font-normal text-gray-500">د.ع</span>
              </dd>
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100">
          <div className="px-4 py-5 sm:p-6 flex items-center">
            <div className={`p-3 rounded-full bg-gray-100 text-gray-600 ml-4`}>
              <DollarSign className="w-8 h-8" />
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 truncate">إجمالي {tabLabel} (الكلي)</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">
                {allTimeTotal.toLocaleString()} <span className="text-sm font-normal text-gray-500">د.ع</span>
              </dd>
            </div>
          </div>
        </div>
      </div>

      {/* Actions and List */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:max-w-md">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder={`ابحث في ${tabLabel}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => handleOpenModal()}
            className={`w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${colorClasses.bg} ${colorClasses.hover} shadow-sm transition-colors`}
          >
            <Plus className="w-5 h-5 ml-2 -mr-1" />
            إضافة {isExpense ? 'مصروف' : 'وارد'} جديد
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{personLabel}</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التفاصيل</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المبلغ</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التاريخ</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                      <p className="text-lg font-medium text-slate-900">جاري تحميل البيانات...</p>
                      <p className="text-sm mt-1">يتم الآن جلب معلومات المالية من السحابة.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    لا توجد بيانات لعرضها. أضف {isExpense ? 'مصروفاً' : 'وارداً'} جديداً للبدء.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="w-4 h-4 ml-2 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{tx.person}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate" title={tx.description}>{tx.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-bold ${colorClasses.text}`}>
                        {Number(tx.amount).toLocaleString()} د.ع
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 ml-1.5 text-gray-400" />
                        {tx.date}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleOpenModal(tx)}
                          className="text-indigo-600 hover:text-indigo-900 transition-colors"
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(tx.id)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={handleCloseModal}></div>
          
          <div className="relative bg-white rounded-2xl text-right shadow-2xl w-full max-w-xl border border-gray-100 flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2" id="modal-title">
                {editingTx ? <Edit2 className="w-5 h-5 text-indigo-600" /> : <Plus className="w-5 h-5 text-indigo-600" />}
                {editingTx ? `تعديل ${isExpense ? 'المصروف' : 'الوارد'}` : `إضافة ${isExpense ? 'مصروف' : 'وارد'} جديد`}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors rounded-full p-1 hover:bg-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              <div className="overflow-y-auto px-6 py-5 space-y-6">
                
                {/* Group 1: Details */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    تفاصيل العملية
                  </h4>
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-4">
                    <div>
                      <label htmlFor="person" className="block text-sm font-medium text-gray-700 mb-1.5">{personLabel} <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        id="person"
                        required
                        className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-shadow bg-white"
                        value={formData.person}
                        onChange={(e) => setFormData({ ...formData, person: e.target.value })}
                        placeholder="مثال: أحمد، شركة التوصيل..."
                      />
                    </div>
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1.5">التفاصيل (على ماذا؟) <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        id="description"
                        required
                        className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-shadow bg-white"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder={isExpense ? "مثال: شراء قرطاسية، دفع فاتورة..." : "مثال: مبيعات اليوم، اشتراك عميل..."}
                      />
                    </div>
                  </div>
                </div>

                {/* Group 2: Amount & Date */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    المبلغ والتاريخ
                  </h4>
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1.5">{amountLabel} <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input
                          type="number"
                          id="amount"
                          required
                          min="0"
                          step="any"
                          className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 pl-12 pr-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-shadow bg-white"
                          value={formData.amount || ''}
                          onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">د.ع</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1.5">التاريخ <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        id="date"
                        required
                        className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-shadow bg-white"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

              </div>
              
              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 sm:flex sm:flex-row-reverse gap-3 shrink-0 rounded-b-2xl">
                <button
                  type="submit"
                  className={`w-full inline-flex justify-center items-center rounded-lg border border-transparent shadow-sm px-5 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto transition-colors ${colorClasses.bg} ${colorClasses.hover} ${colorClasses.ring}`}
                >
                  <CheckCircle className="w-4 h-4 ml-2" />
                  حفظ البيانات
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="mt-3 w-full inline-flex justify-center items-center rounded-lg border border-gray-300 shadow-sm px-5 py-2.5 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDeleteModal 
        isOpen={itemToDelete !== null}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmDelete}
        title="تأكيد حذف العملية"
        message="هل أنت متأكد من حذف هذه العملية المالية؟ لا يمكن التراجع عن هذا الإجراء."
      />
    </div>
  );
}
