import React from 'react';
import { Link } from 'react-router-dom';
import { Layout, Save, Download, Library as LibraryIcon, CheckCircle, Loader } from 'lucide-react';
import { UserMenu } from './UserMenu';

interface FloatingTopBarProps {
    editMode: boolean;
    saveSuccess: boolean;
    isSaving: boolean;
    slidesCount: number;
    hasUser: boolean;
    onSave?: () => void;
    onSaveChanges?: () => void;
    onDownload: () => void;
}

export const FloatingTopBar: React.FC<FloatingTopBarProps> = ({
    editMode,
    saveSuccess,
    isSaving,
    slidesCount,
    hasUser,
    onSave,
    onSaveChanges,
    onDownload,
}) => {
    return (
        <header className="fixed top-0 left-0 right-0 h-16 border-b border-white/10 bg-neutral-900/80 backdrop-blur-md z-50 flex items-center justify-between px-6">
            {/* Left: Logo */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-lg shadow-blue-900/20">
                    <Layout className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-lg font-bold tracking-tight text-white">Agentic Carousel</h1>
                    <p className="text-[10px] text-neutral-500 -mt-0.5 uppercase tracking-wider font-medium">
                        {editMode ? 'Edit Mode' : 'Generator'}
                    </p>
                </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-3">
                {/* Edit Mode Success Indicator */}
                {editMode && saveSuccess && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/50 rounded-lg text-green-400 text-sm">
                        <CheckCircle size={16} />
                        Saved!
                    </div>
                )}

                {/* Library Button */}
                <Link
                    to="/library"
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg text-sm font-medium text-white transition-colors"
                >
                    <LibraryIcon size={16} />
                    <span className="hidden sm:inline">My Carousels</span>
                </Link>

                {/* Save Button (only in generate mode when slides exist) */}
                {!editMode && slidesCount > 0 && hasUser && onSave && (
                    <button
                        onClick={onSave}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg text-sm font-medium text-white transition-all"
                    >
                        <Save size={16} />
                        <span className="hidden sm:inline">Save</span>
                    </button>
                )}

                {/* Save Changes Button (only in edit mode) */}
                {editMode && onSaveChanges && (
                    <button
                        onClick={onSaveChanges}
                        disabled={isSaving || slidesCount === 0}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isSaving || slidesCount === 0
                                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white'
                            }`}
                    >
                        {isSaving ? (
                            <>
                                <Loader size={16} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                Save Changes
                            </>
                        )}
                    </button>
                )}

                {/* Download Button */}
                {slidesCount > 0 && (
                    <button
                        onClick={onDownload}
                        className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg text-sm font-medium text-white transition-colors"
                    >
                        <Download size={16} />
                        <span className="hidden sm:inline">Download</span>
                    </button>
                )}

                <UserMenu />
            </div>
        </header>
    );
};
