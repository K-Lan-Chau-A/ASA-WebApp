import LoginPage from './pages/LoginPage';
import OrdersPage from './pages/OrdersPage';
import OpenShiftPage from './pages/OpenShiftPage';
import PaymentPage from './pages/PaymentPage';
import ProductPage from './pages/ProductPage';
import CategoryPage from './pages/CategoryPage';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"


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
          </Routes>
        </main>

      
      </div>
    </Router>
  )
}
