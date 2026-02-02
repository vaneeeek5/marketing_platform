"use client";

import { useState, useEffect } from 'react';
import { getCampaignColor } from '@/lib/campaign-colors';
import CampaignColorPicker from './CampaignColorPicker';
import { Badge } from "@/components/ui/badge";

interface Props {
    campaign: string;
    showColorPicker?: boolean;
}

export default function CampaignBadge({
    campaign,
    showColorPicker = true
}: Props) {
    const [color, setColor] = useState('#6b7280');

    // Initial load
    useEffect(() => {
        setColor(getCampaignColor(campaign));
    }, [campaign]);

    // Listen for global color updates
    useEffect(() => {
        const handleUpdate = () => {
            setColor(getCampaignColor(campaign));
        };

        window.addEventListener('campaign-colors-updated', handleUpdate);
        return () => window.removeEventListener('campaign-colors-updated', handleUpdate);
    }, [campaign]);

    return (
        <div className="inline-flex items-center gap-1 group">
            <Badge
                variant="secondary"
                className="px-2 py-0.5 text-xs font-medium text-white border-0 transition-colors duration-300"
                style={{ backgroundColor: color }}
            >
                {campaign || "—"}
            </Badge>

            {showColorPicker && campaign && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <CampaignColorPicker
                        campaign={campaign}
                        currentColor={color}
                        onColorChange={setColor}
                    />
                </div>
            )}
        </div>
    );
}
