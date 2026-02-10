import React from 'react';
import { Database, Loader, CheckCircle, XCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { useContactsMigration } from '../../hooks/useContactsMigration';

export default function ContactsMigrationPanel({ onClose }) {
    const { migrateContacts, migrating, progress, error } = useContactsMigration();

    const handleMigrate = async () => {
        try {
            await migrateContacts();
        } catch (err) {
            console.error('Migration failed:', err);
        }
    };

    const progressPercent = progress.total > 0
        ? Math.round((progress.current / progress.total) * 100)
        : 0;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Database className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg">Contacts Migration</h2>
                            <p className="text-sm text-blue-100">Firebase → PostgreSQL</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm text-amber-800 font-medium">Important</p>
                                <p className="text-sm text-amber-700 mt-1">
                                    This checks all contacts from Firebase against PostgreSQL.
                                    Duplicates (matching phone) are skipped to prevent errors.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Progress */}
                    {(migrating || progress.total > 0) && (
                        <div className="space-y-4">
                            <div className="flex justify-between text-sm items-end">
                                <span className="text-gray-600 font-medium">Progress</span>
                                <span className="text-indigo-600 font-bold text-lg">{progress.current} <span className="text-gray-400 text-sm font-normal">/ {progress.total}</span></span>
                            </div>

                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 relative"
                                    style={{ width: `${progressPercent}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                                    <div className="flex items-center gap-2 text-green-700 mb-1">
                                        <CheckCircle className="w-4 h-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Migrated</span>
                                    </div>
                                    <p className="text-2xl font-bold text-green-700">{progress.success}</p>
                                </div>

                                <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                                    <div className="flex items-center gap-2 text-red-700 mb-1">
                                        <XCircle className="w-4 h-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Failed</span>
                                    </div>
                                    <p className="text-2xl font-bold text-red-700">{progress.failed}</p>
                                </div>

                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 col-span-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <AlertTriangle className="w-4 h-4" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Skipped</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-700">{progress.skipped}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>Duplicates (Already exist)</span>
                                            <span className="font-medium">{progress.skippedDuplicate || 0}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>Invalid Phone Numbers</span>
                                            <span className="font-medium">{progress.skippedInvalid || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    {/* Success Message */}
                    {!migrating && progress.total > 0 && progress.current === progress.total && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center animate-fade-in">
                            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                            <p className="font-medium text-green-800">Process Complete!</p>
                            <p className="text-sm text-green-700 mt-1">
                                Check the breakdown above for details.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t p-4 flex gap-3 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-gray-200 bg-white rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                        {progress.total > 0 ? 'Close' : 'Cancel'}
                    </button>
                    <button
                        onClick={handleMigrate}
                        disabled={migrating || (progress.total > 0 && progress.current === progress.total)}
                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                    >
                        {migrating ? (
                            <>
                                <Loader className="w-4 h-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Database className="w-4 h-4" />
                                {progress.total > 0 ? 'Restart' : 'Start Migration'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
