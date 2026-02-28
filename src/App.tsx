import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, Calendar, AlertCircle, CheckCircle, Package, X, Wallet, LayoutDashboard, Users, Box, ShoppingCart } from 'lucide-react';
import { Subscription } from './types';
import Transactions from './components/Transactions';
import Customers from './components/Customers';
import Products from './components/Products';
import Sales from './components/Sales';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';
import { supabase } from './supabaseClient';

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

// Helper to calculate days remaining
const getDaysRemaining = (expirationDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(expirationDate);
  const diffTime = expDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export default function App() {
  const [activePage, setActivePage] = useState<'subscriptions' | 'finances' | 'customers' | 'products' | 'sales'>('subscriptions');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Omit<Subscription, 'id'>>({
    name: '',
    activationDate: '',
    expirationDate: '',
    notes: '',
    category: 'عام',
  });

  useEffect(() => {
    const fetchSubscriptions = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.from('subscriptions').select('*');
      if (data) setSubscriptions(data as Subscription[]);
      if (error) console.error("Error fetching subscriptions:", error);
      setIsLoading(false);
    };

    fetchSubscriptions();

    const channel = supabase
      .channel('schema-db-changes-subscriptions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions' },
        (payload) => {
          fetchSubscriptions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenModal = (sub?: Subscription) => {
    if (sub) {
      setEditingSub(sub);
      setFormData({
        name: sub.name,
        activationDate: sub.activationDate,
        expirationDate: sub.expirationDate,
        notes: sub.notes,
        category: sub.category,
      });
    } else {
      setEditingSub(null);
      setFormData({
        name: '',
        activationDate: new Date().toISOString().split('T')[0],
        expirationDate: '',
        notes: '',
        category: 'عام',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSub(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSub) {
      const { error } = await supabase
        .from('subscriptions')
        .update({ ...formData })
        .eq('id', editingSub.id);
      
      if (error) {
        console.error("Error updating:", error);
        alert(`حدث خطأ أثناء التعديل: ${error.message}`);
      }
    } else {
      const { error } = await supabase
        .from('subscriptions')
        .insert([{ ...formData }]);
        
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
      supabase.from('subscriptions').delete().eq('id', id).then(({ error }) => {
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
    if (itemToDelete) {
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('id', itemToDelete);
        
      if (error) {
        console.error("Error deleting:", error);
        alert(`حدث خطأ أثناء الحذف: ${error.message}`);
      }
      setItemToDelete(null);
    }
  };

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter(sub =>
      sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.notes.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());
  }, [subscriptions, searchQuery]);

  const stats = useMemo(() => {
    let active = 0;
    let expired = 0;
    let expiringSoon = 0; // within 7 days

    subscriptions.forEach(sub => {
      const days = getDaysRemaining(sub.expirationDate);
      if (days < 0) {
        expired++;
      } else if (days <= 7) {
        expiringSoon++;
        active++;
      } else {
        active++;
      }
    });

    return { total: subscriptions.length, active, expired, expiringSoon };
  }, [subscriptions]);

  const getStatusBadge = (expirationDate: string) => {
    const days = getDaysRemaining(expirationDate);
    if (days < 0) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 ml-1" /> منتهي</span>;
    }
    if (days <= 7) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><AlertCircle className="w-3 h-3 ml-1" /> ينتهي قريباً ({days} أيام)</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 ml-1" /> فعال ({days} أيام)</span>;
  };

  const navItems = [
    { id: 'subscriptions', label: 'الاشتراكات', icon: LayoutDashboard },
    { id: 'products', label: 'المنتجات', icon: Box },
    { id: 'sales', label: 'سجل البيع', icon: ShoppingCart },
    { id: 'customers', label: 'الزبائن', icon: Users },
    { id: 'finances', label: 'المالية', icon: Wallet },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row" dir="rtl">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-l border-slate-200 fixed inset-y-0 right-0 z-10">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Package className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Ludex Store storage</h1>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Ludex Store storage</h1>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 md:mr-64 pb-20 md:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activePage === 'subscriptions' ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-4 mb-8">
              <div className="bg-white overflow-hidden shadow-sm rounded-2xl border border-slate-200">
                <div className="px-5 py-6">
                  <dt className="text-sm font-medium text-slate-500 truncate">إجمالي الاشتراكات</dt>
                  <dd className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</dd>
                </div>
              </div>
              <div className="bg-white overflow-hidden shadow-sm rounded-2xl border border-slate-200">
                <div className="px-5 py-6">
                  <dt className="text-sm font-medium text-slate-500 truncate">النشطة حالياً</dt>
                  <dd className="mt-2 text-3xl font-bold text-emerald-600">{stats.active}</dd>
                </div>
              </div>
              <div className="bg-white overflow-hidden shadow-sm rounded-2xl border border-slate-200">
                <div className="px-5 py-6">
                  <dt className="text-sm font-medium text-slate-500 truncate">تنتهي قريباً (أقل من 7 أيام)</dt>
                  <dd className="mt-2 text-3xl font-bold text-amber-500">{stats.expiringSoon}</dd>
                </div>
              </div>
              <div className="bg-white overflow-hidden shadow-sm rounded-2xl border border-slate-200">
                <div className="px-5 py-6">
                  <dt className="text-sm font-medium text-slate-500 truncate">منتهية الصلاحية</dt>
                  <dd className="mt-2 text-3xl font-bold text-red-600">{stats.expired}</dd>
                </div>
              </div>
            </div>

            {/* Actions and List */}
            <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:max-w-md">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-3 pr-10 py-2.5 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-all"
                    placeholder="ابحث عن اشتراك، ملاحظة، أو تصنيف..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => handleOpenModal()}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all active:scale-[0.98]"
                >
                  <Plus className="w-5 h-5 ml-2 -mr-1" />
                  إضافة اشتراك جديد
                </button>
              </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">اسم الاشتراك</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">التصنيف</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">تاريخ التفعيل</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">تاريخ الانتهاء</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">الحالة</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">إجراءات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                        <p className="text-lg font-medium text-slate-900">جاري تحميل البيانات...</p>
                        <p className="text-sm mt-1">يتم الآن جلب معلومات الاشتراكات من السحابة.</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredSubscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <Package className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-lg font-medium text-slate-900">لا توجد اشتراكات</p>
                        <p className="text-sm mt-1">أضف اشتراكاً جديداً للبدء في إدارتها.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSubscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-lg">
                            {sub.name.charAt(0)}
                          </div>
                          <div className="ml-4 mr-4">
                            <div className="text-sm font-bold text-slate-900">{sub.name}</div>
                            {sub.notes && <div className="text-xs text-slate-500 truncate max-w-[150px] mt-0.5">{sub.notes}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-800">
                          {sub.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 ml-1.5 text-slate-400" />
                          {sub.activationDate}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 ml-1.5 text-slate-400" />
                          {sub.expirationDate}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(sub.expirationDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenModal(sub)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="تعديل"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(sub.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
          {/* Backdrop */}
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={handleCloseModal}></div>
          
          {/* Modal Panel */}
          <div className="relative bg-white rounded-2xl text-right shadow-2xl w-full max-w-xl border border-gray-100 flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2" id="modal-title">
                {editingSub ? <Edit2 className="w-5 h-5 text-indigo-600" /> : <Plus className="w-5 h-5 text-indigo-600" />}
                {editingSub ? 'تعديل الاشتراك' : 'إضافة اشتراك جديد'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors rounded-full p-1 hover:bg-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              {/* Scrollable Body */}
              <div className="overflow-y-auto px-6 py-5 space-y-6">
                
                {/* Group 1: Basic Info */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-400" />
                    المعلومات الأساسية
                  </h4>
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">اسم المنتج / الاشتراك <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        id="name"
                        required
                        className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-shadow bg-white"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="مثال: اشتراك نتفليكس، رخصة برنامج..."
                      />
                    </div>
                    <div>
                      <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1.5">التصنيف</label>
                      <input
                        type="text"
                        id="category"
                        className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-shadow bg-white"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="مثال: ترفيه، عمل، خدمات سحابية..."
                      />
                    </div>
                  </div>
                </div>

                {/* Group 2: Dates */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    التواريخ والصلاحية
                  </h4>
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="activationDate" className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ التفعيل <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        id="activationDate"
                        required
                        className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-shadow bg-white"
                        value={formData.activationDate}
                        onChange={(e) => setFormData({ ...formData, activationDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="expirationDate" className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الانتهاء <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        id="expirationDate"
                        required
                        className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-shadow bg-white"
                        value={formData.expirationDate}
                        onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Group 3: Notes */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                    تفاصيل إضافية
                  </h4>
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
                    <textarea
                      id="notes"
                      rows={3}
                      className="block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-shadow bg-white resize-none"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="أي تفاصيل إضافية، روابط، أو معلومات حساب..."
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
        title="تأكيد حذف الاشتراك"
        message="هل أنت متأكد من حذف هذا الاشتراك؟ لا يمكن التراجع عن هذا الإجراء."
      />
          </>
        ) : activePage === 'finances' ? (
          <Transactions />
        ) : activePage === 'products' ? (
          <Products />
        ) : activePage === 'sales' ? (
          <Sales />
        ) : (
          <Customers />
        )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-30 pb-safe">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'fill-indigo-50' : ''}`} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
