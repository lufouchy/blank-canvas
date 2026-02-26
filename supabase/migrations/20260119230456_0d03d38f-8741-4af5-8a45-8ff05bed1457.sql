-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

-- Create enum for time record types
CREATE TYPE public.time_record_type AS ENUM ('entry', 'lunch_out', 'lunch_in', 'exit');

-- Create enum for adjustment request status
CREATE TYPE public.adjustment_status AS ENUM ('pending', 'approved', 'rejected');

-- Create profiles table for user information
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'employee',
    UNIQUE (user_id, role)
);

-- Create work_schedules table for journey rules
CREATE TABLE public.work_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_time TIME NOT NULL DEFAULT '08:00',
    end_time TIME NOT NULL DEFAULT '17:00',
    lunch_duration_minutes INTEGER NOT NULL DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create time_records table for punch records
CREATE TABLE public.time_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    record_type time_record_type NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create adjustment_requests table
CREATE TABLE public.adjustment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    request_type TEXT NOT NULL, -- 'adjustment' or 'medical_certificate'
    requested_time TIMESTAMP WITH TIME ZONE NOT NULL,
    record_type time_record_type NOT NULL,
    reason TEXT NOT NULL,
    status adjustment_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create hours_balance table for tracking overtime
CREATE TABLE public.hours_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    balance_minutes INTEGER NOT NULL DEFAULT 0,
    last_calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hours_balance ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Allow insert for authenticated users" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_roles (only admins can manage roles)
CREATE POLICY "Users can view all roles" ON public.user_roles
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Admins can manage roles" ON public.user_roles
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for work_schedules
CREATE POLICY "Everyone can view schedules" ON public.work_schedules
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Admins can manage schedules" ON public.work_schedules
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for time_records
CREATE POLICY "Users can view own records" ON public.time_records
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own records" ON public.time_records
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- RLS Policies for adjustment_requests
CREATE POLICY "Users can view own requests or admins all" ON public.adjustment_requests
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create own requests" ON public.adjustment_requests
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update requests" ON public.adjustment_requests
    FOR UPDATE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for hours_balance
CREATE POLICY "Users can view own balance or admins all" ON public.hours_balance
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can manage balances" ON public.hours_balance
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default work schedule
INSERT INTO public.work_schedules (name, start_time, end_time, lunch_duration_minutes)
VALUES ('Turno Padrão', '08:00', '17:00', 60);