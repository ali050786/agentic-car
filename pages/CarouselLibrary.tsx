/**
 * Carousel Library Page - Phase 6
 * 
 * Display all user's saved carousels with search, filter, and actions.
 * Now includes Share functionality with analytics.
 * 
 * Location: src/pages/CarouselLibrary.tsx
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import {
  getUserCarousels,
  deleteCarousel,
  duplicateCarousel,
  toggleCarouselPublic,
  Carousel,
} from '../services/carouselService';
import { ShareModal } from '../components/ShareModal';
import { CarouselCard } from '../components/CarouselCard';
import { injectContentIntoSvg } from '../utils/svgInjector';
import { dbToAppTemplate } from '../utils/templateConverter';
import {
  Plus,
  Search,
  Grid,
  List,
  Calendar,
  Trash2,
  Copy,
  Edit,
  Eye,
  EyeOff,
  MoreVertical,
  Layout,
  Share2,
  TrendingUp,
  Globe,
  FileText,
} from 'lucide-react';

export const CarouselLibrary: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [filteredCarousels, setFilteredCarousels] = useState<Carousel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [carouselToShare, setCarouselToShare] = useState<Carousel | null>(null);

  // Load carousels on mount
  useEffect(() => {
    if (user) {
      loadCarousels();
    }
  }, [user]);

  // Filter carousels when search changes
  useEffect(() => {
    filterCarousels();
  }, [searchQuery, carousels]);

  const loadCarousels = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await getUserCarousels(user.$id);

    if (!error && data) {
      setCarousels(data);
    }

    setLoading(false);
  };

  const filterCarousels = () => {
    let filtered = [...carousels];

    // Apply search query
    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredCarousels(filtered);
  };

  const handleDelete = async (carouselId: string) => {
    if (!window.confirm('Are you sure you want to delete this carousel?')) return;

    const { error } = await deleteCarousel(carouselId);

    if (!error) {
      setCarousels(carousels.filter(c => c.$id !== carouselId));
      setActionMenuOpen(null);
    }
  };

  const handleDuplicate = async (carouselId: string) => {
    if (!user) return;

    const { data, error } = await duplicateCarousel(carouselId, user.$id);

    if (!error && data) {
      setCarousels([data, ...carousels]);
      setActionMenuOpen(null);
    }
  };

  const handleTogglePublic = async (carousel: Carousel) => {
    const { data, error } = await toggleCarouselPublic(carousel.$id, !carousel.isPublic);

    if (!error && data) {
      setCarousels(carousels.map(c => c.$id === carousel.$id ? data : c));
      setActionMenuOpen(null);
    }
  };

  const handleEdit = (carousel: Carousel) => {
    // Navigate to home with carousel data - reuses main interface!
    navigate('/', {
      state: {
        editMode: true,
        carouselId: carousel.$id,
        carousel: carousel
      }
    });
  };

  const handleShare = (carousel: Carousel) => {
    setCarouselToShare(carousel);
    setShareModalOpen(true);
    setActionMenuOpen(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTemplateLabel = (template: string) => {
    return template === 'template1' ? 'The Truth' : 'The Clarity';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Loading your carousels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-900 to-neutral-950 text-white">
      {/* Header */}
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-neutral-900">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-lg shadow-blue-900/20">
            <Layout className="w-5 h-5 text-white" />
          </Link>
          <h1 className="text-lg font-bold tracking-tight">My Carousels</h1>
          <span className="text-sm text-neutral-400">({carousels.length})</span>
        </div>

        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg text-sm font-medium transition-all"
        >
          <Plus size={16} />
          New Carousel
        </Link>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-7xl mx-auto">
        {/* Stats Bar */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Carousels */}
          <div className="bg-neutral-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Layout className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-neutral-400">Total Carousels</p>
                <p className="text-2xl font-bold text-white">{carousels.length}</p>
              </div>
            </div>
          </div>

          {/* Public Views */}
          <div className="bg-neutral-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-neutral-400">Public Views</p>
                <p className="text-2xl font-bold text-white">
                  {carousels.reduce((sum, c) => sum + ((c as any).views || 0), 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Drafts */}
          <div className="bg-neutral-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-neutral-400">Drafts</p>
                <p className="text-2xl font-bold text-white">
                  {carousels.filter(c => !c.isPublic).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search carousels..."
              className="w-full pl-11 pr-4 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-neutral-900 border border-white/10 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-white'
                  }`}
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-white'
                  }`}
              >
                <Grid size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Carousels Grid/List */}
        {
          filteredCarousels.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Layout className="w-8 h-8 text-neutral-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {searchQuery ? 'No carousels found' : 'No carousels yet'}
              </h3>
              <p className="text-neutral-400 mb-6">
                {searchQuery
                  ? 'Try adjusting your search'
                  : 'Create your first carousel to get started'}
              </p>
              {!searchQuery && (
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg font-medium transition-all"
                >
                  <Plus size={18} />
                  Create Carousel
                </Link>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCarousels.map((carousel) => (
                <CarouselCard
                  key={carousel.$id}
                  carousel={carousel}
                  onEdit={handleEdit}
                  onShare={handleShare}
                  onDuplicate={handleDuplicate}
                  onTogglePublic={handleTogglePublic}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCarousels.map((carousel) => (
                <div
                  key={carousel.$id}
                  className="bg-neutral-900 border border-white/10 rounded-lg p-4 hover:border-blue-500/50 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {carousel.slides && carousel.slides.length > 0 ? (
                        <div
                          className="w-full h-full"
                          dangerouslySetInnerHTML={{
                            __html: injectContentIntoSvg(
                              dbToAppTemplate(carousel.templateType),
                              carousel.slides[0] as any,
                              carousel.theme
                            )
                          }}
                          style={{
                            transform: 'scale(0.06)',
                            transformOrigin: 'center'
                          }}
                        />
                      ) : (
                        <Layout className="w-6 h-6 text-neutral-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white truncate mb-1">{carousel.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-neutral-500">
                        <span>{getTemplateLabel(carousel.templateType)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(carousel.$createdAt)}
                        </span>
                        {carousel.isPublic && (
                          <>
                            <span>•</span>
                            <span className="text-green-400 flex items-center gap-1">
                              <Eye size={12} />
                              Public
                            </span>
                          </>
                        )}
                        {(carousel as any).views > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Eye size={12} />
                              {(carousel as any).views} views
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(carousel)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleShare(carousel)}
                      className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg transition-colors"
                      title="Share"
                    >
                      <Share2 size={16} />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setActionMenuOpen(actionMenuOpen === carousel.$id ? null : carousel.$id)}
                        className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg transition-colors"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {actionMenuOpen === carousel.$id && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-neutral-800 border border-white/10 rounded-lg shadow-xl overflow-hidden z-10">
                          <button
                            onClick={() => handleDuplicate(carousel.$id)}
                            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/5 flex items-center gap-2 transition-colors"
                          >
                            <Copy size={14} />
                            Duplicate
                          </button>
                          <button
                            onClick={() => handleTogglePublic(carousel)}
                            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/5 flex items-center gap-2 transition-colors"
                          >
                            {carousel.isPublic ? <EyeOff size={14} /> : <Eye size={14} />}
                            Make {carousel.isPublic ? 'Private' : 'Public'}
                          </button>
                          <button
                            onClick={() => handleDelete(carousel.$id)}
                            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors border-t border-white/10"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </main >

      {/* Share Modal */}
      {
        carouselToShare && (
          <ShareModal
            isOpen={shareModalOpen}
            onClose={() => {
              setShareModalOpen(false);
              setCarouselToShare(null);
            }}
            carousel={carouselToShare}
          />
        )
      }
    </div >
  );
};

export default CarouselLibrary;