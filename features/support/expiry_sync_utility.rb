require 'socket'
require 'rspec'

class ExpirySyncUtility
  MAX_SCROLL_COUNT = 10
  
  extend Calabash::Android::Operations
  extend RSpec::Matchers
  
  # Server:
  def self.port_is_open?(ip, port)
    begin
      TCPSocket.new(ip, port)
    rescue Errno::ECONNREFUSED
      return false
    end
    return true
  end
  
  
  def self.my_first_private_ipv4
    Socket.ip_address_list.detect{|intf| intf.ipv4_private?}
  end
  
  def self.reset_api_server_db!
    puts `test_server_scripts/reset_initial_server_db`
  end
  
  def self.start_api_server!
    puts `test_server_scripts/start_server`
  end
  
  def self.stop_api_server!
    puts `test_server_scripts/stop_server`
  end
  
  # Device:
  # Note: There is calabash's built in scroll_to method,
  # but that sometimes raises "Could not find parent scroll view" for me...
  def self.scroll_down_to(query_str, container_query_str = nil)
    q = query(query_str)
    scroll_count = 0
    while q.empty?
      expect(scroll_count).to be <= MAX_SCROLL_COUNT, "element not found: '#{query_str}'"
      
      scroll_count += 1
      if container_query_str.nil?
        scroll_down
      else
        scroll(container_query_str, :down)
      end
      q = query(query_str)
    end
  end
  
  def self.scroll_up_to(query_str, container_query_str = nil)
    q = query(query_str)
    scroll_count = 0
    while q.empty?
      expect(scroll_count).to be <= MAX_SCROLL_COUNT, "element not found: '#{query_str}'"
      
      scroll_count += 1
      if container_query_str.nil?
        scroll_up
      else
        scroll(container_query_str, :up)
      end
      
      q = query(query_str)
    end
  end
  
  def self.scroll_to(query_str, container_query_str = nil)
    begin
      scroll_down_to(query_str, container_query_str)
    rescue RSpec::Expectations::ExpectationNotMetError
      scroll_up_to(query_str, container_query_str)
    end
  end
  
  def self.overwrite_text(query_str, text, scroll = true)
    scroll_to(query_str) if scroll
    clear_text_in(query_str)
    enter_text(query_str, text)
  end
end