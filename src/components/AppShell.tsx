import { useState } from 'react';
import { supabase } from '../lib/supabase';

import Products from './Products';
import Purchases from './Purchases';
import PendingPurchases from './PendingPurchases';
import Stock from './Stock';
import Sales from './Sales';
import Customers from './Customers';
import CustomerOutstanding from './CustomerOutstanding';
import SupplierOutstanding from './SupplierOutstanding';
import Payments from './Payments';
import StockTransfer from './StockTransfer';
import StockAdjustment from './StockAdjustment';
import SalesHistory from "./SalesHistory";
import OpeningStock from './OpeningStock';

type UserRole = 'ADMIN' | 'STAFF';

type Profile = {
  id: string;
  display_name: string | null;
  role: UserRole;
};

type AppShellProps = {
  profile: Profile;
  email: string | undefined;
};

type View =
  | 'STOCK'
  | 'SALES'
  | 'RECEIVE_STOCK'
  | 'CUSTOMERS'
  | 'PRODUCTS'
  | 'PENDING_PURCHASES'
  | 'CUSTOMER_OUTSTANDING'
  | 'SUPPLIER_OUTSTANDING'
  | 'PAYMENTS'
  | 'STOCK_TRANSFER'
  | 'STOCK_ADJUSTMENT'
  | 'SALES_HISTORY'
  | 'OPENING_STOCK';

type MenuItem = {
  id: View;
  label: string;
  adminOnly?: boolean;
};

const menuItems: MenuItem[] = [
  {
    id: 'STOCK',
    label: 'Stock',
  },
  {
    id: 'SALES',
    label: 'New Sale',
  },
  {
    id: 'SALES_HISTORY',
    label: 'Sales History',
    adminOnly: true,
  },
  {
    id: 'RECEIVE_STOCK',
    label: 'Receive Stock',
  },
  {
    id: 'STOCK_TRANSFER',
    label: 'Stock Transfer',
  },
  {
    id: 'STOCK_ADJUSTMENT',
    label: 'Stock Adjustment',
    adminOnly: true,
  },
  {
  id: 'OPENING_STOCK',
  label: 'Opening Stock',
  adminOnly: true,
  },
  {
    id: 'CUSTOMERS',
    label: 'Customers',
  },
  {
    id: 'PRODUCTS',
    label: 'Products',
    adminOnly: true,
  },
  {
    id: 'PENDING_PURCHASES',
    label: 'Pending Purchases',
    adminOnly: true,
  },
  {
    id: 'CUSTOMER_OUTSTANDING',
    label: 'Customer Outstanding',
    adminOnly: true,
  },
  {
    id: 'SUPPLIER_OUTSTANDING',
    label: 'Supplier Outstanding',
    adminOnly: true,
  },
  {
    id: 'PAYMENTS',
    label: 'Payments',
    adminOnly: true,
  },
];

function AppShell({ profile, email }: AppShellProps) {
  const [activeView, setActiveView] = useState<View>('STOCK');

  const visibleMenuItems = menuItems.filter(
    (item) => !item.adminOnly || profile.role === 'ADMIN',
  );

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  function renderView() {
    switch (activeView) {
      case 'STOCK':
        return <Stock />;

      case 'SALES':
        return <Sales />;

      case 'RECEIVE_STOCK':
        return <Purchases />;

      case 'CUSTOMERS':
        return <Customers />;

      case 'PRODUCTS':
        return profile.role === 'ADMIN' ? <Products /> : null;

      case 'PENDING_PURCHASES':
        return profile.role === 'ADMIN'
          ? <PendingPurchases />
          : null;

      case 'CUSTOMER_OUTSTANDING':
        return profile.role === 'ADMIN'
          ? <CustomerOutstanding />
          : null;

      case 'SUPPLIER_OUTSTANDING':
        return profile.role === 'ADMIN'
          ? <SupplierOutstanding />
          : null;

      case 'PAYMENTS':
        return profile.role === 'ADMIN' ? <Payments /> : null;
      
      case 'STOCK_TRANSFER':
        return <StockTransfer />;

      case 'STOCK_ADJUSTMENT':
        return profile.role === 'ADMIN'
          ? <StockAdjustment />
          : null;
      case "SALES_HISTORY":
        return profile.role === "ADMIN"
          ? <SalesHistory />
          : null;
      case 'OPENING_STOCK':
        return profile.role === 'ADMIN'
          ? <OpeningStock />
          : null;
      default:
        return <Stock />;
    }
  }

  return (
    <div>
      <header>
        <div>
          <h1>Family Furniture Management</h1>

          <p>
            {profile.display_name ?? email ?? 'User'} —{' '}
            {profile.role}
          </p>
        </div>

        <button type="button" onClick={() => void handleLogout()}>
          Logout
        </button>
      </header>

      <nav>
        {visibleMenuItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main>{renderView()}</main>
    </div>
  );
}

export default AppShell;