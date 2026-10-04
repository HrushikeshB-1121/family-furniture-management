import { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';

import Products from './Products';
import Categories from './Categories';
import Purchases from './Purchases';
import PendingPurchases from './PendingPurchases';
import Stock from './Stock';
import Sales from './Sales';
import Customers from './Customers';
import Suppliers from './Suppliers';
import CustomerOutstanding from './CustomerOutstanding';
import SupplierOutstanding from './SupplierOutstanding';
import Payments from './Payments';
import StockTransfer from './StockTransfer';
import StockAdjustment from './StockAdjustment';
import SalesHistory from './SalesHistory';
import OpeningStock from './OpeningStock';
import Expenses from './Expenses';
import DailyTransactions from './DailyTransactions';

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
  | 'SUPPLIERS'
  | 'PRODUCTS'
  | 'CATEGORIES'
  | 'PENDING_PURCHASES'
  | 'CUSTOMER_OUTSTANDING'
  | 'SUPPLIER_OUTSTANDING'
  | 'PAYMENTS'
  | 'DAILY_TRANSACTIONS'
  | 'STOCK_TRANSFER'
  | 'STOCK_ADJUSTMENT'
  | 'SALES_HISTORY'
  | 'OPENING_STOCK'
  | 'EXPENSES';

type MenuItem = {
  id: View;
  label: string;
  adminOnly?: boolean;
};

type MenuGroup = {
  id: string;
  label: string;
  items: View[];
};

type DesktopDropdownPosition = {
  top: number;
  left: number;
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
    id: 'SUPPLIERS',
    label: 'Suppliers',
    adminOnly: true,
  },
  {
    id: 'PRODUCTS',
    label: 'Products',
    adminOnly: true,
  },
  {
    id: 'CATEGORIES',
    label: 'Categories',
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
  {
    id: 'DAILY_TRANSACTIONS',
    label: 'Daily Transactions',
    adminOnly: true,
  },
  {
    id: 'EXPENSES',
    label: 'Expenses',
    adminOnly: true,
  },
];

const menuGroups: MenuGroup[] = [
  {
    id: 'sales',
    label: 'Sales',
    items: [
      'SALES',
      'SALES_HISTORY',
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    items: [
      'STOCK',
      'RECEIVE_STOCK',
      'STOCK_TRANSFER',
      'STOCK_ADJUSTMENT',
      'OPENING_STOCK',
    ],
  },
  {
    id: 'payments',
    label: 'Payments & Outstanding',
    items: [
      'DAILY_TRANSACTIONS',
      'PAYMENTS',
      'CUSTOMER_OUTSTANDING',
      'SUPPLIER_OUTSTANDING',
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      'PRODUCTS',
      'CATEGORIES',
      'EXPENSES',
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      'CUSTOMERS',
      'SUPPLIERS',
    ],
  },
];

function AppShell({
  profile,
  email,
}: AppShellProps) {
  const storageKey =
    `familyFurniture.activeView.${profile.id}`;

  const [activeView, setActiveView] =
    useState<View>(() => {
      const savedView =
        sessionStorage.getItem(storageKey);

      if (!savedView) {
        return 'STOCK';
      }

      const allowedView =
        menuItems.find(
          (item) =>
            item.id === savedView &&
            (!item.adminOnly ||
              profile.role === 'ADMIN'),
        );

      return allowedView
        ? (savedView as View)
        : 'STOCK';
    });

  const [openDesktopGroup, setOpenDesktopGroup] =
    useState<string | null>(null);

  const [
    desktopDropdownPosition,
    setDesktopDropdownPosition,
  ] = useState<DesktopDropdownPosition | null>(
    null,
  );

  const [mobileMoreOpen, setMobileMoreOpen] =
    useState(false);

  const visibleMenuItems =
    menuItems.filter(
      (item) =>
        !item.adminOnly ||
        profile.role === 'ADMIN',
    );

  const adminMobilePrimaryViews: View[] = [
    'SALES',
    'STOCK',
    'PENDING_PURCHASES',
    'PAYMENTS',
  ];

  const staffMobilePrimaryViews: View[] = [
    'SALES',
    'RECEIVE_STOCK',
    'STOCK',
    'STOCK_TRANSFER',
  ];

  const mobilePrimaryViews =
    profile.role === 'ADMIN'
      ? adminMobilePrimaryViews
      : staffMobilePrimaryViews;

  const mobilePrimaryItems =
    mobilePrimaryViews
      .map((view) =>
        visibleMenuItems.find(
          (item) => item.id === view,
        ),
      )
      .filter(
        (item): item is MenuItem =>
          Boolean(item),
      );

  const mobileMoreItems =
    visibleMenuItems.filter(
      (item) =>
        !mobilePrimaryViews.includes(
          item.id,
        ),
    );

  const pendingPurchasesItem =
    visibleMenuItems.find(
      (item) =>
        item.id === 'PENDING_PURCHASES',
    );

  const openDesktopGroupData =
    menuGroups.find(
      (group) =>
        group.id === openDesktopGroup,
    );

  const openDesktopGroupItems =
    openDesktopGroupData
      ? openDesktopGroupData.items
          .map((view) =>
            visibleMenuItems.find(
              (item) => item.id === view,
            ),
          )
          .filter(
            (item): item is MenuItem =>
              Boolean(item),
          )
      : [];

  function handleViewChange(
    view: View,
  ) {
    setActiveView(view);

    sessionStorage.setItem(
      storageKey,
      view,
    );

    setOpenDesktopGroup(null);
    setDesktopDropdownPosition(null);
    setMobileMoreOpen(false);
  }

  function handleDesktopGroupChange(
    groupId: string,
    button: HTMLButtonElement,
  ) {
    if (openDesktopGroup === groupId) {
      setOpenDesktopGroup(null);
      setDesktopDropdownPosition(null);
      return;
    }

    const rect =
      button.getBoundingClientRect();

    const dropdownWidth = 220;
    const horizontalPadding = 8;

    const maxLeft =
      Math.max(
        horizontalPadding,
        window.innerWidth -
          dropdownWidth -
          horizontalPadding,
      );

    const left = Math.min(
      Math.max(
        horizontalPadding,
        rect.left,
      ),
      maxLeft,
    );

    setDesktopDropdownPosition({
      top: rect.bottom + 6,
      left,
    });

    setOpenDesktopGroup(groupId);
  }

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

      case 'SUPPLIERS':
        return profile.role === 'ADMIN'
          ? <Suppliers />
          : null;

      case 'PRODUCTS':
        return profile.role === 'ADMIN'
          ? <Products />
          : null;

      case 'CATEGORIES':
        return profile.role === 'ADMIN'
          ? <Categories />
          : null;

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
        return profile.role === 'ADMIN'
          ? <Payments />
          : null;

      case 'DAILY_TRANSACTIONS':
        return profile.role === 'ADMIN'
          ? <DailyTransactions />
          : null;

      case 'EXPENSES':
        return profile.role === 'ADMIN'
          ? <Expenses />
          : null;

      case 'STOCK_TRANSFER':
        return <StockTransfer />;

      case 'STOCK_ADJUSTMENT':
        return profile.role === 'ADMIN'
          ? <StockAdjustment />
          : null;

      case 'SALES_HISTORY':
        return profile.role === 'ADMIN'
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

  const currentPage =
    menuItems.find(
      (item) =>
        item.id === activeView,
    );

  return (
    <>
      <style>
        {`
          .app-shell {
            min-height: 100svh;
            background: #f6f8fb;
            overflow: visible !important;
          }

          .app-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            min-height: 72px;
            padding: 12px 24px;
            background: #ffffff;
            border-bottom: 1px solid #e4e7ec;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.05);
          }

          .app-brand {
            min-width: 0;
          }

          .app-title {
            margin: 0;
            color: #101828;
            font-size: 21px;
            line-height: 1.25;
            font-weight: 700;
            letter-spacing: -0.3px;
          }

          .app-user {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 4px;
            color: #667085;
            font-size: 13px;
          }

          .app-role {
            display: inline-flex;
            align-items: center;
            min-height: 22px;
            padding: 2px 8px;
            border-radius: 999px;
            background: #eff6ff;
            color: #1d4ed8;
            font-size: 11px;
            font-weight: 700;
          }

          .app-header-actions {
            flex: 0 0 auto;
          }

          .app-logout {
            min-height: 38px;
            padding: 7px 13px;
          }

          .desktop-nav {
            position: sticky;
            top: 0;
            z-index: 100;
            display: flex;
            gap: 6px;
            padding: 9px 24px;
            background: #ffffff;
            border-bottom: 1px solid #e4e7ec;
            box-shadow:
              0 1px 2px rgba(16, 24, 40, 0.03);
            overflow: visible !important;
          }

          .desktop-nav-group {
            position: relative;
            overflow: visible !important;
          }

          .desktop-nav-group-button {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            min-height: 38px;
            padding: 7px 13px;
            border: 1px solid transparent;
            border-radius: 8px;
            background: transparent;
            color: #667085;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
          }

          .desktop-nav-group-button:hover,
          .desktop-nav-group-button.open {
            background: #f9fafb;
            border-color: #e4e7ec;
            color: #101828;
          }

          .desktop-nav-group-button.active {
            background: #eff6ff;
            border-color: #bfdbfe;
            color: #1d4ed8;
          }

          .desktop-nav-chevron {
            font-size: 10px;
            line-height: 1;
          }

          .desktop-nav-dropdown {
            position: fixed;
            z-index: 100000;
            min-width: 220px;
            padding: 6px;
            background: #ffffff;
            border: 1px solid #e4e7ec;
            border-radius: 10px;
            box-shadow:
              0 10px 24px rgba(16, 24, 40, 0.18);
          }

          .desktop-nav-item {
            display: block;
            width: 100%;
            min-height: 38px;
            padding: 8px 11px;
            border: 1px solid transparent;
            border-radius: 7px;
            background: transparent;
            color: #475467;
            font-size: 13px;
            font-weight: 500;
            text-align: left;
            cursor: pointer;
          }

          .desktop-nav-item:hover {
            background: #f9fafb;
            color: #101828;
          }

          .desktop-nav-item.active {
            background: #eff6ff;
            color: #1d4ed8;
            font-weight: 600;
          }

          .desktop-nav-quick-button {
            display: inline-flex;
            align-items: center;
            min-height: 38px;
            padding: 7px 13px;
            border: 1px solid transparent;
            border-radius: 8px;
            background: transparent;
            color: #667085;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
          }

          .desktop-nav-quick-button:hover,
          .desktop-nav-quick-button.active {
            background: #eff6ff;
            border-color: #bfdbfe;
            color: #1d4ed8;
          }

          .app-content {
            position: relative;
            z-index: 0;
            width: 100%;
            box-sizing: border-box;
          }

          .app-current-page {
            display: none;
          }

          .mobile-bottom-nav {
            display: none;
          }

          .mobile-more-panel {
            display: none;
          }

          @media (max-width: 640px) {
            .app-header {
              align-items: flex-start;
              min-height: 64px;
              padding: 10px 14px;
            }

            .app-title {
              font-size: 17px;
              line-height: 1.3;
            }

            .app-user {
              gap: 6px;
              margin-top: 3px;
              font-size: 11px;
            }

            .app-role {
              min-height: 20px;
              padding: 2px 7px;
              font-size: 10px;
            }

            .app-logout {
              min-height: 34px;
              padding: 6px 10px;
              font-size: 12px;
            }

            .desktop-nav {
              display: none;
            }

            .app-content {
              padding-bottom: 76px;
            }

            .mobile-bottom-nav {
              position: fixed;
              left: 0;
              right: 0;
              bottom: 0;
              z-index: 50;
              display: grid;
              grid-template-columns:
                repeat(5, minmax(0, 1fr));
              gap: 2px;
              padding:
                7px 7px
                calc(
                  7px + env(safe-area-inset-bottom)
                );
              background: rgba(255, 255, 255, 0.98);
              border-top: 1px solid #e4e7ec;
              box-shadow:
                0 -4px 16px rgba(16, 24, 40, 0.06);
              backdrop-filter: blur(10px);
            }

            .mobile-nav-button {
              min-width: 0;
              min-height: 52px;
              padding: 6px 3px;
              border: 1px solid transparent;
              border-radius: 9px;
              background: transparent;
              color: #667085;
              font-size: 10px;
              line-height: 1.2;
              font-weight: 600;
              cursor: pointer;
            }

            .mobile-nav-button.active {
              background: #eff6ff;
              border-color: #bfdbfe;
              color: #1d4ed8;
            }

            .mobile-nav-button.more-active {
              background: #f2f4f7;
              border-color: #d0d5dd;
              color: #344054;
            }

            .mobile-nav-button-label {
              display: block;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .mobile-more-panel {
              position: fixed;
              left: 10px;
              right: 10px;
              bottom: calc(
                71px + env(safe-area-inset-bottom)
              );
              z-index: 45;
              display: block;
              max-height: 70vh;
              overflow-y: auto;
              padding: 14px;
              background: #ffffff;
              border: 1px solid #e4e7ec;
              border-radius: 14px;
              box-shadow:
                0 14px 34px rgba(16, 24, 40, 0.14);
            }

            .mobile-more-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              margin-bottom: 12px;
            }

            .mobile-more-title {
              margin: 0;
              color: #101828;
              font-size: 15px;
              font-weight: 700;
            }

            .mobile-more-close {
              width: 32px;
              height: 32px;
              padding: 0;
              border: 1px solid #e4e7ec;
              border-radius: 7px;
              background: #f9fafb;
              color: #667085;
              font-size: 17px;
              cursor: pointer;
            }

            .mobile-more-section {
              margin-top: 14px;
            }

            .mobile-more-section:first-of-type {
              margin-top: 0;
            }

            .mobile-more-section-title {
              margin: 0 0 7px;
              color: #98a2b3;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }

            .mobile-more-items {
              display: grid;
              gap: 5px;
            }

            .mobile-more-item {
              width: 100%;
              min-height: 40px;
              padding: 8px 10px;
              border: 1px solid #eaecf0;
              border-radius: 8px;
              background: #ffffff;
              color: #344054;
              font-size: 13px;
              font-weight: 500;
              text-align: left;
              cursor: pointer;
            }

            .mobile-more-item:hover,
            .mobile-more-item.active {
              background: #eff6ff;
              border-color: #bfdbfe;
              color: #1d4ed8;
            }
          }
        `}
      </style>

      <div className="app-shell">
        <header className="app-header">
          <div className="app-brand">
            <h1 className="app-title">
              Family Furniture Management
            </h1>

            <div className="app-user">
              <span>
                {profile.display_name ??
                  email ??
                  'User'}
              </span>

              <span>•</span>

              <span className="app-role">
                {profile.role}
              </span>
            </div>
          </div>

          <div className="app-header-actions">
            <button
              type="button"
              className="app-logout"
              onClick={() =>
                void handleLogout()
              }
            >
              Logout
            </button>
          </div>
        </header>

        <nav className="desktop-nav">
          {menuGroups.map((group) => {
            const groupItems =
              group.items
                .map((view) =>
                  visibleMenuItems.find(
                    (item) =>
                      item.id === view,
                  ),
                )
                .filter(
                  (
                    item,
                  ): item is MenuItem =>
                    Boolean(item),
                );

            if (
              groupItems.length === 0
            ) {
              return null;
            }

            const groupHasActiveView =
              groupItems.some(
                (item) =>
                  item.id === activeView,
              );

            const isOpen =
              openDesktopGroup ===
              group.id;

            return (
              <div
                key={group.id}
                className="desktop-nav-group"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  className={[
                    'desktop-nav-group-button',
                    groupHasActiveView
                      ? 'active'
                      : '',
                    isOpen
                      ? 'open'
                      : '',
                  ]
                    .join(' ')
                    .trim()}
                  onClick={(event) =>
                    handleDesktopGroupChange(
                      group.id,
                      event.currentTarget,
                    )
                  }
                >
                  {group.label}

                  <span className="desktop-nav-chevron">
                    {isOpen
                      ? '▲'
                      : '▼'}
                  </span>
                </button>
              </div>
            );
          })}

          {profile.role === 'ADMIN' &&
            pendingPurchasesItem && (
              <button
                type="button"
                className={[
                  'desktop-nav-quick-button',
                  activeView ===
                  'PENDING_PURCHASES'
                    ? 'active'
                    : '',
                ]
                  .join(' ')
                  .trim()}
                onClick={() =>
                  handleViewChange(
                    'PENDING_PURCHASES',
                  )
                }
              >
                {pendingPurchasesItem.label}
              </button>
            )}
        </nav>

        {openDesktopGroup &&
          desktopDropdownPosition &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              className="desktop-nav-dropdown"
              style={{
                top: desktopDropdownPosition.top,
                left: desktopDropdownPosition.left,
              }}
            >
              {openDesktopGroupItems.map(
                (item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={[
                      'desktop-nav-item',
                      item.id ===
                      activeView
                        ? 'active'
                        : '',
                    ]
                      .join(' ')
                      .trim()}
                    onClick={() =>
                      handleViewChange(
                        item.id,
                      )
                    }
                  >
                    {item.label}
                  </button>
                ),
              )}
            </div>,
            document.body,
          )}

        {currentPage && (
          <div className="app-current-page">
            {currentPage.label}
          </div>
        )}

        <div className="app-content">
          {renderView()}
        </div>

        <nav className="mobile-bottom-nav">
          {mobilePrimaryItems.map(
            (item) => (
              <button
                key={item.id}
                type="button"
                className={[
                  'mobile-nav-button',
                  item.id === activeView
                    ? 'active'
                    : '',
                ]
                  .join(' ')
                  .trim()}
                onClick={() =>
                  handleViewChange(
                    item.id,
                  )
                }
              >
                <span className="mobile-nav-button-label">
                  {item.label}
                </span>
              </button>
            ),
          )}

          <button
            type="button"
            className={[
              'mobile-nav-button',
              mobileMoreOpen ||
              mobileMoreItems.some(
                (item) =>
                  item.id ===
                  activeView,
              )
                ? 'more-active'
                : '',
            ]
              .join(' ')
              .trim()}
            onClick={() =>
              setMobileMoreOpen(
                (current) =>
                  !current,
              )
            }
          >
            <span className="mobile-nav-button-label">
              More
            </span>
          </button>
        </nav>

        {mobileMoreOpen && (
          <div className="mobile-more-panel">
            <div className="mobile-more-header">
              <h2 className="mobile-more-title">
                More
              </h2>

              <button
                type="button"
                className="mobile-more-close"
                aria-label="Close menu"
                onClick={() =>
                  setMobileMoreOpen(false)
                }
              >
                ×
              </button>
            </div>

            {menuGroups.map(
              (group) => {
                const groupItems =
                  group.items
                    .map((view) =>
                      mobileMoreItems.find(
                        (item) =>
                          item.id ===
                          view,
                      ),
                    )
                    .filter(
                      (
                        item,
                      ): item is MenuItem =>
                        Boolean(item),
                    );

                if (
                  groupItems.length ===
                  0
                ) {
                  return null;
                }

                return (
                  <section
                    key={group.id}
                    className="mobile-more-section"
                  >
                    <h3 className="mobile-more-section-title">
                      {group.label}
                    </h3>

                    <div className="mobile-more-items">
                      {groupItems.map(
                        (item) => (
                          <button
                            key={
                              item.id
                            }
                            type="button"
                            className={[
                              'mobile-more-item',
                              item.id ===
                              activeView
                                ? 'active'
                                : '',
                            ]
                              .join(' ')
                              .trim()}
                            onClick={() =>
                              handleViewChange(
                                item.id,
                              )
                            }
                          >
                            {item.label}
                          </button>
                        ),
                      )}
                    </div>
                  </section>
                );
              },
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default AppShell;
