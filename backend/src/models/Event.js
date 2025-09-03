const { getSupabase } = require('../config/supabase');

/**
 * Event model stub backed by Supabase "events" table.
 * This replaces MongoDB usage to avoid runtime errors.
 */
class Event {
  /**
   * Track an event (insert into Supabase events table)
   * @param {string} userId 
   * @param {string} type 
   * @param {object} metadata 
   */
  static async trackEvent(userId, type, metadata = {}) {
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('events')
        .insert([{
          user_id: userId,
          type,
          metadata,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.warn('Supabase event insert failed:', error.message);
      }
    } catch (err) {
      console.error('trackEvent failed:', err.message);
    }
  }

  /**
   * Find events (basic stub, filters only by userId if provided)
   * @param {object} query 
   */
  static async find(query = {}) {
    try {
      const supabase = getSupabase();
      let q = supabase.from('events').select('*');

      if (query.userId) {
        q = q.eq('user_id', query.userId);
      }
      if (query.type) {
        q = q.eq('type', query.type);
      }

      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) {
        console.warn('Supabase Event.find error:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('Event.find failed:', err.message);
      return [];
    }
  }

  /**
   * Count documents/events matching query
   */
  static async countDocuments(query = {}) {
    try {
      const supabase = getSupabase();
      let q = supabase.from('events').select('*', { count: 'exact', head: true });

      if (query.userId) {
        q = q.eq('user_id', query.userId);
      }
      if (query.type) {
        q = q.eq('type', query.type);
      }
      if (query.createdAt?.$gte) {
        q = q.gte('created_at', query.createdAt.$gte.toISOString());
      }

      const { count, error } = await q;
      if (error) {
        console.warn('Supabase Event.countDocuments error:', error.message);
        return 0;
      }
      return count || 0;
    } catch (err) {
      console.error('countDocuments failed:', err.message);
      return 0;
    }
  }

  /**
   * Distinct user IDs by time range (for DAU/WAU/MAU)
   */
  static async distinct(field, filter = {}) {
    if (field !== 'userId') return [];
    try {
      const supabase = getSupabase();
      let q = supabase.from('events').select('user_id');

      if (filter.createdAt?.$gte) {
        q = q.gte('created_at', filter.createdAt.$gte.toISOString());
      }
      if (filter.createdAt?.$lte) {
        q = q.lte('created_at', filter.createdAt.$lte.toISOString());
      }

      const { data, error } = await q;
      if (error) {
        console.warn('Supabase Event.distinct error:', error.message);
        return [];
      }
      const ids = [...new Set((data || []).map(e => e.user_id))];
      return ids;
    } catch (err) {
      console.error('Event.distinct failed:', err.message);
      return [];
    }
  }

  /**
   * Aggregate funnel stub – not fully implemented, returns empty
   */
  static async getConversionFunnel(events, startDate, endDate) {
    console.log('Stub getConversionFunnel called', { events, startDate, endDate });
    return {};
  }
}

module.exports = Event;