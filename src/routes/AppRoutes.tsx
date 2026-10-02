import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
  RouterProvider,
} from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';
import WelcomePage from '../pages/WelcomePage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import DashboardPage from '../pages/DashboardPage';
import DiscoverPage from '../pages/DiscoverPage';
import ItineraryListPage from '../pages/ItineraryListPage';
import ItineraryNewPage from '../pages/ItineraryNewPage';
import ItineraryEditPage from '../pages/ItineraryEditPage';
import ItineraryDetailPage from '../pages/ItineraryDetailPage';
import SettlementHubPage from '../pages/SettlementHubPage';
import SettlementWorkspacePage from '../pages/SettlementWorkspacePage';
import DashboardLayout from '../layouts/DashboardLayout';
import SharedTripPage from '../pages/SharedTripPage';

// Data router (createBrowserRouter) chứ không phải <BrowserRouter> — `useBlocker`
// chỉ hoạt động với data router, và ta cần nó để chặn rời trang khi còn thay đổi
// chưa lưu (trip-board.md R10).
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route element={<PublicRoute />}>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/itinerary" element={<ItineraryListPage />} />
          <Route path="/itinerary/new" element={<ItineraryNewPage />} />
          <Route path="/itinerary/:tripId" element={<ItineraryDetailPage />} />
          <Route path="/itinerary/:tripId/edit/:step" element={<ItineraryEditPage />} />
          <Route path="/itinerary/:tripId/edit" element={<Navigate to="1" replace />} />
          <Route path="/settlement" element={<SettlementHubPage />} />
          <Route path="/settlement/:tripId" element={<SettlementWorkspacePage />} />
        </Route>
      </Route>

      {/* Trang chia sẻ công khai: không qua PublicRoute (người đã đăng nhập vẫn
          mở được) cũng không qua ProtectedRoute (khách không cần tài khoản). */}
      <Route path="/share/:token" element={<SharedTripPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>,
  ),
);

export default function AppRoutes() {
  return <RouterProvider router={router} />;
}
