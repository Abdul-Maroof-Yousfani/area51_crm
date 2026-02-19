import React from 'react';
import { X, CheckCircle2, XCircle, AlertTriangle, Loader2, FileSpreadsheet } from 'lucide-react';

/**
 * CsvImportModal
 *
 * Props:
 *  progress: {
 *    open: bool,
 *    total: number,
 *    current: number,
 *    successCount: number,
 *    failedRows: [{ rowNumber, clientName, error }],
 *    done: bool,
 *    unmatchedSources: string[],
 *  }
 *  onClose: () => void  -- only allowed when done===true
 */
export default function CsvImportModal({ progress, onClose }) {
    if (!progress || !progress.open) return null;

    const {
        total = 0,
        current = 0,
        successCount = 0,
        failedRows = [],
        done = false,
        unmatchedSources = [],
    } = progress;

    const failedCount = failedRows.length;
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;

    const handleClose = () => {
        if (!done) return; // block close while running
        onClose();
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget && done) onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={handleBackdropClick}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
                            <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-base">CSV Import</h3>
                            <p className="text-xs text-gray-500">
                                {done ? 'Import complete' : 'Importing leads, please wait…'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={!done}
                        title={done ? 'Close' : 'Please wait until import finishes'}
                        className={`p-2 rounded-lg transition-colors ${done
                                ? 'hover:bg-gray-100 text-gray-500 cursor-pointer'
                                : 'text-gray-300 cursor-not-allowed'
                            }`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5">
                    {/* Progress bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 font-medium">
                                {done ? 'Finished' : `Processing row ${current} of ${total}`}
                            </span>
                            <span className="font-bold text-gray-800">{pct}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                            <div
                                className={`h-3 rounded-full transition-all duration-300 ${done && failedCount === 0
                                        ? 'bg-green-500'
                                        : done && failedCount > 0
                                            ? 'bg-amber-500'
                                            : 'bg-blue-500'
                                    }`}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>

                    {/* Counts */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                            <div>
                                <p className="text-xs text-green-600 font-medium">Imported</p>
                                <p className="text-xl font-bold text-green-700">{successCount}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                            <div>
                                <p className="text-xs text-red-600 font-medium">Failed</p>
                                <p className="text-xl font-bold text-red-700">{failedCount}</p>
                            </div>
                        </div>
                    </div>

                    {/* In-progress spinner */}
                    {!done && (
                        <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
                            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                            <span>
                                Do not close or refresh this page while import is running.
                            </span>
                        </div>
                    )}

                    {/* Unmatched sources warning */}
                    {done && unmatchedSources.length > 0 && (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm">
                            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-amber-700">Unmatched sources</p>
                                <p className="text-amber-600 text-xs mt-0.5">
                                    These sources were not found and saved as plain text:{' '}
                                    <span className="font-mono">{unmatchedSources.join(', ')}</span>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Failed rows table */}
                    {failedRows.length > 0 && (
                        <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2">
                                Failed Rows ({failedCount})
                            </p>
                            <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200">
                                <table className="w-full text-xs">
                                    <thead className="bg-red-50 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-semibold text-red-700 w-14">Row #</th>
                                            <th className="px-3 py-2 text-left font-semibold text-red-700 w-28">Client</th>
                                            <th className="px-3 py-2 text-left font-semibold text-red-700">Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-red-100">
                                        {failedRows.map((r, i) => (
                                            <tr key={i}>
                                                <td className="px-3 py-2 text-gray-500 font-mono">{r.rowNumber}</td>
                                                <td className="px-3 py-2 text-gray-700 font-medium truncate max-w-[6rem]">
                                                    {r.clientName || '—'}
                                                </td>
                                                <td className="px-3 py-2 text-red-600 break-words">{r.error}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {done && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-slate-50 flex justify-end">
                        <button
                            onClick={handleClose}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
