import type { RouteObject } from 'react-router-dom';
import { ConfirmationPage } from './booking/ConfirmationPage';
import { ExtrasPage } from './booking/ExtrasPage';
import { PassengersPage } from './booking/PassengersPage';
import { PaymentPage } from './booking/PaymentPage';
import { ResultsPage } from './booking/ResultsPage';
import { SeatsPage } from './booking/SeatsPage';
import { HomePage } from './home/HomePage';
import { Shell } from './layout/Shell';
import { ManagePage } from './manage/ManagePage';
import { AccountPage } from './account/AccountPage';
import { LoginPage } from './account/LoginPage';
import { PreferencesPage } from './account/PreferencesPage';
import { RegisterPage } from './account/RegisterPage';

/** Route tree shared by both sites. */
export const siteRoutes: RouteObject[] = [
  {
    element: <Shell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'booking/flights', element: <ResultsPage /> },
      { path: 'booking/passengers', element: <PassengersPage /> },
      { path: 'booking/extras', element: <ExtrasPage /> },
      { path: 'booking/seats', element: <SeatsPage /> },
      { path: 'booking/payment', element: <PaymentPage /> },
      { path: 'booking/confirmation', element: <ConfirmationPage /> },
      { path: 'manage', element: <ManagePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: 'preferences', element: <PreferencesPage /> },
      { path: '*', element: <HomePage /> },
    ],
  },
];
