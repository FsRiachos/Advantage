# Payment Verification App

A payment verification application that uses AI to automatically extract payment amounts from receipt images. Built with Next.js frontend and Supabase backend with Gemini 1.5 Flash for AI-powered payment verification.

## Features

- **Athlete Management**: Track athletes and their monthly fees
- **Payment Upload**: Upload payment receipt images
- **AI Verification**: Automatically extract payment amounts using Gemini 1.5 Flash
- **Status Tracking**: Monitor payment status (pending, processing, verified, rejected)
- **Real-time Updates**: Live status updates as payments are processed

## Architecture

### Frontend (Next.js)
- React with TypeScript
- Tailwind CSS for styling
- Supabase client for data operations

### Backend (Supabase)
- PostgreSQL database with athletes and payments tables
- Edge Functions for AI processing
- Storage for receipt images
- Row Level Security (RLS) enabled

### AI Integration
- Gemini 1.5 Flash API for payment amount extraction
- Image processing and text recognition

## Setup

### Prerequisites
- Node.js 18+
- Supabase CLI
- Google AI Studio API key

### 1. Clone and Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Install environment variables
cp .env.local.example .env.local
```

### 2. Configure Supabase

1. Create a new Supabase project
2. Set up the following environment variables in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. Set up Supabase secrets:
   ```bash
   supabase secrets set GEMINI_API_KEY=your_gemini_api_key
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

### 3. Database Setup

Apply the database schema:
```bash
supabase db push
```

### 4. Deploy Edge Functions

Deploy the payment verification function:
```bash
supabase functions deploy verify-payment
```

### 5. Create Storage Bucket

Create a storage bucket for payment receipts:
```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-receipts', 'payment-receipts', true);
```

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Supabase Secrets
```
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Database Schema

### Athletes Table
- `id`: UUID (Primary Key)
- `name`: TEXT (Athlete name)
- `monthly_fee`: DECIMAL(10,2) (Monthly fee amount)
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

### Payments Table
- `id`: UUID (Primary Key)
- `athlete_id`: UUID (Foreign Key to athletes)
- `image_url`: TEXT (Receipt image URL)
- `amount_detected`: DECIMAL(10,2) (AI-detected amount)
- `status`: TEXT (pending, verified, rejected, processing)
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

## GitHub Actions

The project includes a GitHub Actions workflow for automatic deployment:

1. Set up the following repository secrets:
   - `SUPABASE_ACCESS_TOKEN`: Your Supabase access token
   - `SUPABASE_PROJECT_ID`: Your Supabase project ID

2. Push to main/develop branches to trigger deployment

## Usage

1. **Add Athletes**: First add athletes to the system with their monthly fees
2. **Upload Receipts**: Select an athlete and upload their payment receipt
3. **AI Processing**: The system automatically processes the image using Gemini AI
4. **Review Results**: Check the payment status and detected amount
5. **Track Payments**: View all payments and their verification status

## Security

- Row Level Security (RLS) enabled on all tables
- Service role keys used for backend operations
- Image uploads restricted to authenticated users
- Environment variables for sensitive data

## Development

### Local Development
```bash
# Start Supabase local development
supabase start

# Start frontend development server
cd frontend
npm run dev
```

### Database Migrations
```bash
# Create new migration
supabase db diff

# Apply migrations
supabase db push
```

### Edge Functions
```bash
# Deploy function
supabase functions deploy verify-payment

# Test function locally
supabase functions serve verify-payment --no-verify-jwt
```

## Troubleshooting

### Common Issues

1. **Gemini API Errors**: Check your API key and quota
2. **Image Upload Issues**: Verify storage bucket permissions
3. **Database Connection**: Check Supabase URL and keys
4. **Function Deployment**: Ensure CLI is properly configured

### Logs

- Supabase logs: `supabase functions logs verify-payment`
- Frontend logs: Browser developer console
- Database logs: Supabase dashboard

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
