-- Create athletes table
CREATE TABLE athletes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    monthly_fee DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payments table
CREATE TABLE payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    amount_detected DECIMAL(10, 2),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'processing')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_payments_athlete_id ON payments(athlete_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_athletes_updated_at BEFORE UPDATE ON athletes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust according to your auth needs)
CREATE POLICY "Athletes are viewable by everyone." ON athletes
    FOR SELECT USING (true);

CREATE POLICY "Payments are viewable by everyone." ON payments
    FOR SELECT USING (true);

CREATE POLICY "Athletes are insertable by everyone." ON athletes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Payments are insertable by everyone." ON payments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Athletes are updatable by everyone." ON athletes
    FOR UPDATE USING (true);

CREATE POLICY "Payments are updatable by everyone." ON payments
    FOR UPDATE USING (true);
