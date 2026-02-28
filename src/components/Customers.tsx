import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, Users, User, AtSign, Calendar, FileText, CheckCircle, X, ShoppingBag } from 'lucide-react';
import { Customer, Purchase } from '../types';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { supabase } from '../supabaseClient';

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState<Omit<Customer, 'id'>>({
    name: '',
    username: '',
    purchases: [],
    notes: '',
  });

  useEffect(() => {
    // 1. دالة تجيب البيانات أول ما يفتح البرنامج
    const fetchCustomers = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.from('customers').select('*');
      if (data) setCustomers(data as Customer[]);
      if (error) console.error("Error fetching:", error);
      setIsLoading(false);
    };

    fetchCustomers();

    // 2. نشغل ميزة التحديث التلقائي (Real-time)
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // يشمل الإضافة، التعديل، والحذف
          schema: 'public',
          table: 'customers' // خلي اسم الجدول مالتك هنا
        },
        (payload) => {
          console.log('صار تغيير بالبيانات!', payload);
          // نحدث الواجهة فوراً من يصير تغيير
          fetchCustomers();
        }
      )
      .subscribe();

    // تنظيف الاشتراك من المستخدم يطلع من الصفحة حتى ما يصير ثقل بالبرنامج
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        username: customer.username,
        purchases: customer.purchases ? [...customer.purchases] : [],
        notes: customer.notes || '',
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '',
        username: '',
        purchases: [],
        notes: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      const { error } = await supabase
        .from('customers')
        .update({ ...formData })
        .eq('id', editingCustomer.id);
      
      if (error) {
        console.error("Error updating:", error);
        alert(`حدث خطأ أثناء التعديل: ${error.message}`);
      }
    } else {
      const { error } = await supabase
        .from('customers')
        .insert([{ ...formData }]);
        
      if (error) {
        console.error("Error inserting:", error);
        alert(`حدث خطأ أثناء الإضافة: ${error.message}`);
      }
    }
    handleCloseModal();
  };

  const handleDeleteClick = (id: string | undefined) => {
    if (!id) return;
    
    const skipWarning = localStorage.getItem('skipDeleteWarning') === 'true';
    if (skipWarning) {
      // Delete directly
      supabase.from('customers').delete().eq('id', id).then(({ error }) => {
        if (error) {
          console.error("Error deleting:", error);
          alert(`حدث خطأ أثناء الحذف: ${error.message}`);
        }
      });
    } else {
      setItemToDelete(id);
    }
  };

  const confirmDelete = async () => {
    if (itemToDelete !== null && itemToDelete !== undefined) {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', itemToDelete);
        
      if (error) {
        console.error("Error deleting:", error);
        alert(`حدث خطأ أثناء الحذف: ${error.message}`);
      }
      setItemToDelete(null);
    } else {
      setItemToDelete(null);
    }
  };

  const handleAddPurchase = () => {
    setFormData(prev => ({
      ...prev,
      purchases: [
        ...prev.purchases,
        { id: generateId(), date: new Date().toISOString().split('T')[0], details: '' }
      ]
    }));
  };

  const handleUpdatePurchase = (id: string, field: keyof Purchase, value: string) => {
    setFormData(prev => ({
      ...prev,
      purchases: prev.purchases.map(p => p.id === id ? { ...p, [field]: value } : p)
    }));
  };

  const handleRemovePurchase = (id: string) => {
    setFormData(prev => ({
      ...prev,
      purchases: prev.purchases.filter(p => p.id !== id)
    }));
  };

  const filteredCustomers = useMemo(() => {
    return customers
      .filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.notes?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        // Sort by latest purchase date
        const aPurchases = a.purchases || [];
        const bPurchases = b.purchases || [];
        const aLast = aPurchases.length > 0 ? Math.max(...aPurchases.map(p => new Date(p.date).getTime())) : 0;
        const bLast = bPurchases.length > 0 ? Math.max(...bPurchases.map(p => new Date(p.date).getTime())) : 0;
        return bLast - aLast;
      });
  }, [customers, searchQuery]);

  const stats = useMemo(() => {
    const totalCustomers = customers.length;
    const totalPurchases = customers.reduce((sum, c) => sum + (c.purchases?.length || 0), 0);
    return { totalCustomers, totalPurchases };
  }, [customers]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100">
          <div className="px-4 py-5 sm:p-6 flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600 ml-4">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 truncate">إجمالي الزبائن</dt>
              <dd className="mt-1 text-3xl font-semibold text-blue-600">{stats.totalCustomers}</dd>
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100">
          <div className="px-4 py-5 sm:p-6 flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600 ml-4">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 truncate">إجمالي عمليات الشراء</dt>
              <dd className="mt-1 text-3xl font-semibold text-purple-600">{stats.totalPurchases}</dd>
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
              placeholder="ابحث عن زبون، يوزر، أو ملاحظة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <Plus className="w-5 h-5 ml-2 -mr-1" />
            إضافة زبون جديد
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">اسم الزبون</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">يوزر الحساب</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">عدد المرات</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">آخر شراء</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الملاحظات</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                      <p className="text-lg font-medium text-slate-900">جاري تحميل البيانات...</p>
                      <p className="text-sm mt-1">يتم الآن جلب معلومات الزبائن من السحابة.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Users className="w-12 h-12 text-slate-300 mb-4" />
                      <p className="text-lg font-medium text-slate-900">لا يوجد زبائن</p>
                      <p className="text-sm mt-1">أضف زبوناً جديداً للبدء في إدارة زبائنك.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const purchases = customer.purchases || [];
                  const lastPurchase = purchases.length > 0 
                    ? [...purchases].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                    : null;

                  return (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="w-4 h-4 ml-2 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{customer.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <AtSign className="w-4 h-4 ml-1 text-gray-400" />
                          <span dir="ltr" className="text-right">{customer.username || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {purchases.length} مرات
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {lastPurchase ? (
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 ml-1.5 text-gray-400" />
                            {lastPurchase.date}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-[150px] truncate" title={customer.notes}>
                          {customer.notes || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleOpenModal(customer)}
                            className="text-indigo-600 hover:text-indigo-900 transition-colors"
                            title="تعديل"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(customer.id)}
                            className="text-red-600 hover:text-red-900 transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={handleCloseModal}></div>
          
          <div className="relative bg-white rounded-2xl text-right shadow-2xl w-full max-w-2xl border border-gray-100 flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2" id="modal-title">
                {editingCustomer ? <Edit2 className="w-5 h-5 text-indigo-600" /> : <Plus className="w-5 h-5 text-indigo-600" />}
                {editingCustomer ? 'تعديل بيانات الزبون' : 'إضافة زبون جديد'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors rounded-full p-1 hover:bg-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              <div className="overflow-y-auto px-6 py-5 space-y-6">
                
                {/* Group 1: Basic Info */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    المعلومات الأساسية
                  </h4>
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">اسم الزبون <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        id="name"
                        required
                        className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-shadow bg-white"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="مثال: محمد علي"
                      />
                    </div>
                    <div>
                      <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">يوزر الحساب</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <AtSign className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          id="username"
                          dir="ltr"
                          className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-shadow bg-white text-left"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          placeholder="username"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Group 2: Purchases */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-gray-400" />
                      سجل المشتريات
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddPurchase}
                      className="inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-md transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 ml-1" />
                      إضافة شراء
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {formData.purchases.length === 0 ? (
                      <div className="text-center py-6 bg-gray-50/50 rounded-xl border border-gray-100 border-dashed">
                        <p className="text-sm text-gray-500">لم يتم إضافة أي مشتريات بعد.</p>
                      </div>
                    ) : (
                      formData.purchases.map((purchase, index) => (
                        <div key={purchase.id} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm relative group">
                          <div className="absolute -right-2 -top-2 bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                            {index + 1}
                          </div>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-1">
                              <label className="block text-xs font-medium text-gray-500 mb-1">تاريخ الشراء</label>
                              <input
                                type="date"
                                required
                                className="block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                value={purchase.date}
                                onChange={(e) => handleUpdatePurchase(purchase.id, 'date', e.target.value)}
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-500 mb-1">التفاصيل (المنتج)</label>
                              <input
                                type="text"
                                required
                                className="block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                value={purchase.details}
                                onChange={(e) => handleUpdatePurchase(purchase.id, 'details', e.target.value)}
                                placeholder="مثال: اشتراك نتفليكس شهر"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePurchase(purchase.id)}
                            className="mt-5 text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50"
                            title="حذف هذا الشراء"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Group 3: Notes */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    ملاحظات عامة
                  </h4>
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                    <textarea
                      id="notes"
                      rows={3}
                      className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-shadow bg-white resize-none"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="أي ملاحظات إضافية حول الزبون، طريقة الدفع المفضلة، إلخ..."
                    ></textarea>
                  </div>
                </div>

              </div>
              
              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 sm:flex sm:flex-row-reverse gap-3 shrink-0 rounded-b-2xl">
                <button
                  type="submit"
                  className="w-full inline-flex justify-center items-center rounded-lg border border-transparent shadow-sm px-5 py-2.5 bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto transition-colors"
                >
                  <CheckCircle className="w-4 h-4 ml-2" />
                  حفظ بيانات الزبون
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
        title="تأكيد حذف الزبون"
        message="هل أنت متأكد من حذف هذا الزبون؟ لا يمكن التراجع عن هذا الإجراء."
      />
    </div>
  );
}
