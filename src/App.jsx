import OrdersPage from './pages/OrdersPage';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"


export default function App() {
  return (
    <Router>
      <div>
        
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/orders" />} />
            <Route path="/orders" element={<OrdersPage />} />
          </Routes>
        </main>

      
      </div>
    </Router>
  )
}
