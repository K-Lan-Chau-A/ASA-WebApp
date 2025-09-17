import LoginPage from './pages/LoginPage';
import OrdersPage from './pages/OrdersPage';
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
          </Routes>
        </main>

      
      </div>
    </Router>
  )
}
