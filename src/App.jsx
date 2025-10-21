
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import LoginPage from './pages/LoginPage';
import OrdersPage from './pages/OrdersPage';
import OpenShiftPage from './pages/OpenShiftPage';
import PaymentPage from './pages/PaymentPage';
import ProductPage from './pages/ProductPage';
import CategoryPage from './pages/CategoryPage';
import CustomerPage from './pages/CustomerPage';
import VoucherPage from './pages/VoucherPage';
import RankPage from './pages/RankPage';
import PromotionPage from './pages/PromotionPage';
import UserFeaturePage from './pages/UserFeaturePage';

export default function App() {
  return (
    <Router>
      <div>
        
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/open-shift" element={<OpenShiftPage />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/products" element={<ProductPage />} />
            <Route path="/categories" element={<CategoryPage />} />
            <Route path="/customers" element={<CustomerPage />} />
            <Route path="/vouchers" element={<VoucherPage />} />
            <Route path="/ranks" element={<RankPage />} />
            <Route path="/promotions" element={<PromotionPage />} />
            <Route path="/user-features" element={<UserFeaturePage />} />
          </Routes>
        </main>

      
      </div>
    </Router>
  )
}
