import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Code2, History as HistoryIcon, LogOut, User } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3 text-white font-bold text-lg hover:opacity-90">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <Shield className="w-5 h-5" />
          </div>
          <span>AI Code Review Platform</span>
        </Link>

        <div className="flex items-center space-x-3">
          {user ? (
            <>
              <Link
                to="/"
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  location.pathname === '/'
                    ? 'text-white bg-slate-800'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Code2 className="w-4 h-4" />
                <span>New Review</span>
              </Link>

              <Link
                to="/history"
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  location.pathname === '/history'
                    ? 'text-white bg-slate-800'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <HistoryIcon className="w-4 h-4" />
                <span>History</span>
              </Link>

              <div className="flex items-center space-x-2 pl-3 border-l border-slate-800">
                <div className="flex items-center space-x-2 text-sm text-slate-400">
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="font-medium text-slate-200">{user.name || user.email}</span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-indigo-400 border border-slate-700">
                    {user.role || 'user'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800 transition"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center space-x-3">
              <Link
                to="/login"
                className="text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-md hover:bg-slate-800 transition"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-md transition"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
