"use client";

import { useState } from 'react';
import { setCampaignColor } from '@/lib/campaign-colors';

interface Props {
    campaign: string;
    currentColor: string;
    onColorChange: (color: string) => void;
}

export default function CampaignColorPicker({
    campaign,
    currentColor,
    onColorChange
}: Props) {
    const [isOpen, setIsOpen] = useState(false);

    const presetColors = [
        '#ef4444', // red
        '#f97316', // orange
        '#f59e0b', // amber
        '#84cc16', // lime
        '#10b981', // emerald
        '#06b6d4', // cyan
        '#3b82f6', // blue
        '#6366f1', // indigo
        '#8b5cf6', // violet
        '#ec4899', // pink
        '#6b7280', // gray
        '#000000', // black
    ];

    const handleColorSelect = (color: string) => {
        setCampaignColor(campaign, color);
        onColorChange(color);
        setIsOpen(false);
    };

    return (
        <div className="relative inline-block ml-1">
            <button
                onClick={(e) => {
                    e.stopPropagation(); // Prevent row click
                    setIsOpen(!isOpen);
                }}
                className="w-4 h-4 rounded-sm border border-white/20 shadow-sm hover:scale-110 transition-transform cursor-pointer"
                style={{ backgroundColor: currentColor }}
                title="Изменить цвет кампании"
            />

            {isOpen && (
                <>
                    {/* Overlay to close */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                        }}
                    />

                    {/* Palette Popover */}
                    <div className="absolute left-0 top-full z-50 mt-2 p-3 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 min-w-[200px]">
                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Цвет для "{campaign}"
                        </div>

                        <div className="grid grid-cols-4 gap-2 mb-3">
                            {presetColors.map(color => (
                                <button
                                    key={color}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleColorSelect(color);
                                    }}
                                    className="w-6 h-6 rounded border border-gray-200 dark:border-gray-700 hover:border-gray-400 transition-all hover:scale-110"
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                        </div>

                        {/* Custom Color Input */}
                        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">
                                Свой цвет
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    defaultValue={currentColor}
                                    onChange={(e) => handleColorSelect(e.target.value)}
                                    className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-xs font-mono text-gray-500">{currentColor}</span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
